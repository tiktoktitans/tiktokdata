// ---------- testTok.ts (new file) ----------
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testHashtag() {
  const id = '1613123321562117'; // the same ID you’ve been trying
  try {
    const resp = await axios.get(
      `https://tokapi-mobile-version.p.rapidapi.com/v1/hashtag/posts/${id}`,
      {
        params: {
          count: 20,
          offset: 0,
          region: 'US', // you can also try removing this line or changing to 'GLOBAL'
        },
        headers: {
          'X-RapidAPI-Key': process.env.TOKAPI_KEY!,
          'X-RapidAPI-Host': 'tokapi-mobile-version.p.rapidapi.com',
        },
      }
    );
    console.log('✅ 200 OK – Here is the raw response:', JSON.stringify(resp.data, null, 2));
  } catch (err: any) {
    console.error(
      '❌ ERROR:', 
      'Status Code:', err.response?.status, 
      'Response Body:', err.response?.data || err.message
    );
  }
}

testHashtag();
