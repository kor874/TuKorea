from flask import Flask, render_template, request
from googleapiclient.discovery import build
from config import API_KEY
import re

app = Flask(__name__)

youtube = build(
    "youtube",
    "v3",
    developerKey=API_KEY
)


def format_duration(duration):
    """
    PT1H2M30S -> 1시간 2분 30초
    PT15M8S   -> 15분 8초
    PT45S     -> 45초
    """

    hours = 0
    minutes = 0
    seconds = 0

    h = re.search(r"(\d+)H", duration)
    m = re.search(r"(\d+)M", duration)
    s = re.search(r"(\d+)S", duration)

    if h:
        hours = int(h.group(1))

    if m:
        minutes = int(m.group(1))

    if s:
        seconds = int(s.group(1))

    if hours > 0:
        return f"{hours}시간 {minutes}분 {seconds}초"

    if minutes > 0:
        return f"{minutes}분 {seconds}초"

    return f"{seconds}초"


@app.route("/", methods=["GET"])
def home():

    keyword = request.args.get("keyword")
    videos = []

    if keyword:

        search_items = []
        next_page = None

        # 최대 100개 검색
        for _ in range(2):

            search_response = youtube.search().list(
                q=keyword,
                part="snippet",
                maxResults=50,
                type="video",
                pageToken=next_page
            ).execute()

            search_items.extend(search_response["items"])

            next_page = search_response.get("nextPageToken")

            if not next_page:
                break

        print("총 검색 영상:", len(search_items))

        for item in search_items:

            video_id = item["id"]["videoId"]

            video_response = youtube.videos().list(
                part="snippet,statistics,contentDetails",
                id=video_id
            ).execute()

            if not video_response["items"]:
                continue

            video = video_response["items"][0]

            snippet = video["snippet"]
            statistics = video["statistics"]
            content = video["contentDetails"]

            title = snippet["title"]
            channel = snippet["channelTitle"]

            published = snippet["publishedAt"][:10]

            duration = format_duration(
                content["duration"]
            )

            views = int(
                statistics.get("viewCount", 0)
            )

            likes = int(
                statistics.get("likeCount", 0)
            )

            comments = int(
                statistics.get("commentCount", 0)
            )

            if views > 0:
                like_rate = likes / views * 100
                comment_rate = comments / views * 100
            else:
                like_rate = 0
                comment_rate = 0

            score = (
                views
                + likes * 20
                + comments * 50
            )

            thumbnail = snippet["thumbnails"]["high"]["url"]

            url = f"https://www.youtube.com/watch?v={video_id}"

            videos.append({

                "title": title,

                "channel": channel,

                "views": views,

                "likes": likes,

                "comments": comments,

                "score": score,

                "thumbnail": thumbnail,

                "url": url,

                "published": published,

                "duration": duration,

                "like_rate": round(like_rate, 2),

                "comment_rate": round(comment_rate, 2)

            })

        print("최종 수집 영상 수:", len(videos))

        videos.sort(
            key=lambda x: x["score"],
            reverse=True
        )

    return render_template(
        "index.html",
        videos=videos,
        keyword=keyword
    )


if __name__ == "__main__":
    app.run(debug=True)