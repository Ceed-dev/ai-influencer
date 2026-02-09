'use strict';

const fs = require('fs');
const { google } = require('googleapis');
const config = require('../../config');

function getYouTubeClient() {
  const oauth2 = new google.auth.OAuth2(
    config.youtube.clientId,
    config.youtube.clientSecret
  );
  oauth2.setCredentials({ refresh_token: config.youtube.refreshToken });
  return google.youtube({ version: 'v3', auth: oauth2 });
}

async function upload({ videoPath, title, description, tags, categoryId }) {
  const youtube = getYouTubeClient();

  const res = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title,
        description: `${description}\n#Shorts`,
        tags: tags || [],
        categoryId: categoryId || '22', // People & Blogs
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const videoId = res.data.id;
  return {
    videoId,
    url: `https://youtube.com/shorts/${videoId}`,
  };
}

module.exports = { upload };
