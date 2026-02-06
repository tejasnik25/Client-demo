
const fs = require('fs');
const path = require('path');

console.log("🚀 Starting Upload Test...");

async function testUpload() {
  const filePath = path.join(__dirname, 'test_server.dat');
  fs.writeFileSync(filePath, 'dummy content');

  const formData = new FormData();
  const fileBlob = new Blob([fs.readFileSync(filePath)], { type: 'application/octet-stream' });
  formData.append('file', fileBlob, 'test_server.dat');

  try {
    console.log('Testing connection to http://127.0.0.1:8000/server-definitions...');
    const listRes = await fetch('http://127.0.0.1:8000/server-definitions', {
        headers: { 'x-api-key': '9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad' }
    });
    
    if (listRes.ok) {
        console.log('✅ GET /server-definitions successful');
        console.log(await listRes.json());
    } else {
        console.error('❌ GET /server-definitions failed:', listRes.status);
        console.error(await listRes.text());
    }

    console.log('Testing upload to http://127.0.0.1:8000/upload/server-definition...');
    const res = await fetch('http://127.0.0.1:8000/upload/server-definition', {
      method: 'POST',
      headers: {
        'x-api-key': '9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad'
      },
      body: formData
    });

    if (res.ok) {
      console.log('✅ Upload successful');
      console.log(await res.json());
    } else {
      console.error('❌ Upload failed:', res.status);
      console.error(await res.text());
    }
  } catch (err) {
    console.error('❌ Connection error:', err);
  } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

testUpload();
