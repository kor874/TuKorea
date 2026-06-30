const API_KEY = "AIzaSyDx7JiTZ0D4OjgagrIjDcL0W-r_tNPFx9Y";

document.getElementById('search-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const keyword = document.getElementById('keyword-input').value.trim();
    if (keyword) {
        searchYouTube(keyword);
    }
});

// ISO 8601 기간 포맷 변환 (PT1H2M30S -> 1시간 2분 30초)
function formatDuration(duration) {
    const hMatch = duration.match(/(\d+)H/);
    const mMatch = duration.match(/(\d+)M/);
    const sMatch = duration.match(/(\d+)S/);

    const hours = hMatch ? parseInt(hMatch[1]) : 0;
    const minutes = mMatch ? parseInt(mMatch[1]) : 0;
    const seconds = sMatch ? parseInt(sMatch[1]) : 0;

    if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초`;
    if (minutes > 0) return `${minutes}분 ${seconds}초`;
    return `${seconds}초`;
}

async function searchYouTube(keyword) {
    const videoListContainer = document.getElementById('video-list');
    videoListContainer.innerHTML = '<p class="result-count">검색 중입니다...</p>';
    
    let searchItems = [];
    let nextPageToken = '';
    
    try {
        // 1. 키워드 검색 (최대 2페이지, 총 100개 요청)
        for (let i = 0; i < 2; i++) {
            let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&type=video&q=${encodeURIComponent(keyword)}&key=${API_KEY}`;
            if (nextPageToken) {
                searchUrl += `&pageToken=${nextPageToken}`;
            }
            
            const response = await fetch(searchUrl);
            const data = await response.json();
            
            if (data.items) {
                searchItems = searchItems.concat(data.items);
            }
            
            nextPageToken = data.nextPageToken;
            if (!nextPageToken) break;
        }

        if (searchItems.length === 0) {
            videoListContainer.innerHTML = '<p class="result-count">검색 결과가 없습니다.</p>';
            return;
        }

        // 2. 비디오 상세 정보 가져오기 (상세 데이터는 한 번에 최대 50개씩 가져올 수 있으므로 나누어 요청)
        const videoIds = searchItems.map(item => item.id.videoId);
        const chunkedIds = [];
        for (let i = 0; i < videoIds.length; i += 50) {
            chunkedIds.push(videoIds.slice(i, i + 50));
        }

        let videos = [];

        for (const ids of chunkedIds) {
            const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${API_KEY}`;
            const response = await fetch(detailsUrl);
            const data = await response.json();
            
            if (data.items) {
                data.items.forEach(video => {
                    const snippet = video.snippet;
                    const statistics = video.statistics;
                    const content = video.contentDetails;

                    const views = parseInt(statistics.viewCount || 0);
                    const likes = parseInt(statistics.likeCount || 0);
                    const comments = parseInt(statistics.commentCount || 0);

                    const likeRate = views > 0 ? (likes / views) * 100 : 0;
                    const commentRate = views > 0 ? (comments / views) * 100 : 0;
                    const score = views + (likes * 20) + (comments * 50);

                    videos.push({
                        title: snippet.title,
                        channel: snippet.channelTitle,
                        published: snippet.publishedAt.substring(0, 10),
                        duration: formatDuration(content.duration),
                        views: views,
                        likes: likes,
                        comments: comments,
                        likeRate: likeRate.toFixed(2),
                        commentRate: commentRate.toFixed(2),
                        score: score,
                        thumbnail: snippet.thumbnails.high ? snippet.thumbnails.high.url : snippet.thumbnails.default.url,
                        url: `https://www.youtube.com/watch?v=${video.id}`
                    });
                });
            }
        }

        // 스코어 기준 내림차순 정렬
        videos.sort((a, b) => b.score - a.score);

        // 3. UI 업데이트
        document.getElementById('result-keyword').innerText = `"${keyword}" 검색 결과`;
        document.getElementById('result-count').innerText = `총 ${videos.length}개의 영상을 찾았습니다.`;
        document.getElementById('result-header').style.display = 'block';

        videoListContainer.innerHTML = ''; // 초기화
        
        videos.forEach((video, index) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${video.thumbnail}" class="thumbnail" alt="thumbnail">
                <div class="info">
                    <h2>🏆 ${index + 1}위</h2>
                    <h3>${video.title}</h3>
                    <p>📺 ${video.channel}</p>
                    <p>📅 업로드 : ${video.published}</p>
                    <p>⏱ 길이 : ${video.duration}</p>
                    <p>👀 조회수 : ${video.views.toLocaleString()}</p>
                    <p>👍 좋아요 : ${video.likes.toLocaleString()} (${video.likeRate}%)</p>
                    <p>💬 댓글 : ${video.comments.toLocaleString()} (${video.commentRate}%)</p>
                    <p class="score">⭐ TuKorea Score : ${video.score.toLocaleString()}</p>
                    <a href="${video.url}" target="_blank" class="btn">유튜브에서 보기</a>
                </div>
            `;
            videoListContainer.appendChild(card);
        });

    } catch (error) {
        console.error("에러 발생:", error);
        videoListContainer.innerHTML = '<p class="result-count" style="color:red;">데이터를 가져오는 중 오류가 발생했습니다.</p>';
    }
}