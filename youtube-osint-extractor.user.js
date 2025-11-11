// ==UserScript==
// @name         YouTube OSINT Advanced
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Extract hidden YouTube OSINT data
// @author       You
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function extractData() {
        const data = {};
        const html = document.documentElement.innerHTML;

        // Video ID
        const videoMatch = window.location.search.match(/v=([^&]+)/);
        if (videoMatch) data['Video ID'] = videoMatch[1];

        // Hidden data from page source
        const channelId = html.match(/"channelId":"([^"]+)"/);
        if (channelId) data['Channel ID'] = channelId[1];

        const uploadDate = html.match(/"uploadDate":"([^"]+)"/);
        if (uploadDate) data['Upload Date (ISO)'] = uploadDate[1];

        const viewCount = html.match(/"viewCount":"(\d+)"/);
        if (viewCount) data['Exact View Count'] = parseInt(viewCount[1]).toLocaleString();

        // Like/Dislike data (multiple patterns)
        const likeCount = html.match(/"likeCount":(\d+)/) || html.match(/"defaultText":{"accessibility":{"accessibilityData":{"label":"(\d+[,\d]*) likes"/);
        if (likeCount) data['Like Count'] = parseInt(likeCount[1].replace(/,/g, '')).toLocaleString();

        // Dislike count (hidden but sometimes in source)
        const dislikeCount = html.match(/"dislikeCount":(\d+)/) || html.match(/"toggledText":{"accessibility":{"accessibilityData":{"label":"(\d+[,\d]*) dislikes"/);
        if (dislikeCount) data['Dislike Count'] = parseInt(dislikeCount[1].replace(/,/g, '')).toLocaleString();

        // Engagement ratio calculation
        if (likeCount) {
            const likes = parseInt(likeCount[1].replace(/,/g, ''));
            const views = viewCount ? parseInt(viewCount[1]) : 0;
            if (views > 0) {
                const engagementRate = ((likes / views) * 100).toFixed(2);
                data['Like Engagement Rate'] = engagementRate + '%';
            }
        }

        // Comments count
        const commentCount = html.match(/"commentCount":{"simpleText":"([^"]+)"}/) || html.match(/"commentsEntryPointHeaderRenderer":{"headerText":{"runs":\[{"text":"([^"]+) Comments"/);
        if (commentCount) data['Comment Count'] = commentCount[1];

        // Rating (if available)
        const rating = html.match(/"averageRating":(\d+\.\d+)/);
        if (rating) data['Average Rating'] = rating[1] + '/5';

        // Like/Dislike ratio estimation from engagement data
        const sentimentData = html.match(/"sentimentBar":{"sentimentBarRenderer":{"percentIfIndifferent":(\d+)/);
        if (sentimentData) data['Positive Sentiment'] = sentimentData[1] + '%';

        const duration = html.match(/"lengthSeconds":"(\d+)"/);
        if (duration) data['Duration (seconds)'] = duration[1];

        const keywords = html.match(/"keywords":\[([^\]]+)\]/);
        if (keywords) {
            const tags = keywords[1].replace(/"/g, '').split(',');
            data['Tags'] = tags.slice(0, 5).join(', ');
        }

        const category = html.match(/"category":"([^"]+)"/);
        if (category) data['Category'] = category[1];

        const isLive = html.match(/"isLiveContent":(true|false)/);
        if (isLive) data['Is Live Content'] = isLive[1];

        const familySafe = html.match(/"isFamilySafe":(true|false)/);
        if (familySafe) data['Family Safe'] = familySafe[1];

        const subCount = html.match(/"subscriberCountText":{"simpleText":"([^"]+)"/);
        if (subCount) data['Subscriber Count'] = subCount[1];

        const quality = html.match(/"qualityLabel":"([^"]+)"/);
        if (quality) data['Max Quality'] = quality[1];

        if (data['Video ID']) {
            data['HD Thumbnail'] = `https://i.ytimg.com/vi/${data['Video ID']}/maxresdefault.jpg`;
        }

        // Channel handle
        const handleMatch = window.location.pathname.match(/\/@([^/?]+)/) ||
                           document.querySelector('ytd-channel-name a')?.href.match(/\/@([^/?]+)/);
        if (handleMatch) data['Channel Handle'] = '@' + handleMatch[1];

        // Additional engagement metrics
        const shareCount = html.match(/"shareCount":(\d+)/);
        if (shareCount) data['Share Count'] = parseInt(shareCount[1]).toLocaleString();

        // Video age calculation
        if (uploadDate && uploadDate[1]) {
            const uploaded = new Date(uploadDate[1]);
            const now = new Date();
            if (!isNaN(uploaded.getTime())) {
                const daysDiff = Math.floor((now - uploaded) / (1000 * 60 * 60 * 24));
                data['Days Since Upload'] = daysDiff;
            }
        }



        return data;
    }

    async function showPanel() {
        const data = extractData();

        // Fetch dislike data if video ID exists
        if (data['Video ID']) {
            try {
                const response = await fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${data['Video ID']}`);
                const apiData = await response.json();
                data['Dislike Count'] = apiData.dislikes?.toLocaleString() || 'N/A';
                data['Rating'] = apiData.rating?.toFixed(2) + '/5' || 'N/A';
            } catch (e) {
                data['API Status'] = 'Failed to fetch dislike data';
            }
        }

        const existing = document.getElementById('osint-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'osint-panel';
        panel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 99999; background: white; border: 2px solid #red;
            border-radius: 8px; padding: 20px; max-width: 600px; max-height: 80vh;
            overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;

        const title = document.createElement('h3');
        title.textContent = 'YouTube OSINT Data';
        title.style.margin = '0 0 15px 0';
        panel.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'position: absolute; top: 10px; right: 15px; border: none; background: none; font-size: 20px; cursor: pointer;';
        closeBtn.onclick = () => panel.remove();
        panel.appendChild(closeBtn);

        for (const [key, value] of Object.entries(data)) {
            const item = document.createElement('div');
            item.style.cssText = 'margin: 8px 0; padding: 8px; background: #f5f5f5; border-left: 3px solid #red;';

            const label = document.createElement('strong');
            label.textContent = key + ': ';

            const valueSpan = document.createElement('span');
            valueSpan.textContent = value;
            valueSpan.style.wordBreak = 'break-all';

            item.appendChild(label);
            item.appendChild(valueSpan);
            panel.appendChild(item);
        }

        const copyAllBtn = document.createElement('button');
        copyAllBtn.textContent = 'Copy All Data';
        copyAllBtn.style.cssText = 'width: 100%; padding: 10px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;';
        copyAllBtn.onclick = () => {
            let allData = 'YouTube OSINT Data:\n\n';
            for (const [key, value] of Object.entries(data)) {
                allData += key + ': ' + value + '\n';
            }
            navigator.clipboard.writeText(allData);
            copyAllBtn.textContent = 'All Data Copied!';
            setTimeout(() => copyAllBtn.textContent = 'Copy All Data', 2000);
        };
        panel.appendChild(copyAllBtn);

        document.body.appendChild(panel);
    }

    const btn = document.createElement('button');
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.zIndex = '99999';
    btn.style.padding = '10px';
    btn.style.background = 'red';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.textContent = 'OSINT Extract';
    btn.onclick = showPanel;

    document.body.appendChild(btn);
})();