// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// 타입 정의
interface Artist {
  name: string;
  imageUrl?: string;
}
interface RecommendedArtist {
  artistName: string;
  spotifyTrackId: string;
}
interface GenreRecommendation {
  name: string;
  description: string;
  artists: RecommendedArtist[];
}
// ▼▼▼ 이 부분을 추가하세요 ▼▼▼
interface Track {
  name: string;
  url: string;
}
// ▲▲▲ 이 부분을 추가하세요 ▲▲▲

function App() {
  const [query, setQuery] = useState('');
  const [searchedArtist, setSearchedArtist] = useState<Artist | null>(null);
  const [recommendations, setRecommendations] = useState<GenreRecommendation[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // ▼▼▼ 이 부분이 수정되었습니다 (불필요한 'hash' 변수 삭제) ▼▼▼
    const tokenFromUrl = new URLSearchParams(window.location.search).get('access_token');
    const tokenFromStorage = localStorage.getItem('spotify_access_token');

    if (tokenFromUrl) {
        localStorage.setItem('spotify_access_token', tokenFromUrl);
        setAccessToken(tokenFromUrl);
        window.history.pushState({}, document.title, "/"); 
    } else if (tokenFromStorage) {
        setAccessToken(tokenFromStorage);
    }
    // ▲▲▲ 이 부분이 수정되었습니다 ▲▲▲
  }, []);

  const handleLogin = () => {
    window.location.href = 'https://genre-finder-backend.onrender.com/api/login';
  };

  const handleLogout = () => {
    setAccessToken(null);
    localStorage.removeItem('spotify_access_token');
    window.location.reload();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setError('아티스트 이름을 입력해주세요.');
      return;
    }
    if (!accessToken) {
      setError('먼저 Spotify로 로그인해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setSearchedArtist(null);
    setRecommendations([]);
    setTopTracks([]);

    try {
      const response = await axios.post('https://genre-finder-backend.onrender.com/api/recommend-genres', { 
        query,
        accessToken
      });
      setSearchedArtist(response.data.searchedArtist);
      setRecommendations(response.data.aiRecommendations);
    } catch (err: any) {
      setError(err.response?.data?.error || '추천 정보를 가져오는 데 실패했습니다. 아티스트 이름을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlaylist = async () => {
    if (!accessToken || !recommendations.length || !searchedArtist) {
      alert('먼저 아티스트를 검색해주세요.');
      return;
    }

    const trackIds = recommendations.flatMap(genre => genre.artists.map(artist => artist.spotifyTrackId));

    try {
        const response = await axios.post('https://genre-finder-backend.onrender.com/api/save-playlist', {
            accessToken,
            trackIds,
            artistName: searchedArtist.name
        });
        alert(`플레이리스트가 성공적으로 생성되었습니다! Spotify에서 확인해보세요.\nURL: ${response.data.playlistUrl}`);
    } catch (err) {
        alert('플레이리스트 생성에 실패했습니다.');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        {accessToken ? (
          <button onClick={handleLogout} className="logout-button">Logout</button>
        ) : (
          <button onClick={handleLogin} className="login-button">Login with Spotify</button>
        )}

        <h1>Genre Finder</h1>
        <p>AI가 당신의 취향에 맞는 새로운 음악 장르를 찾아드립니다.</p>
        
        {accessToken && (
          <form onSubmit={handleSearch}>
           

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="좋아하는 아티스트 혹은 곡명을 입력하세요"
            disabled={loading}
          />
            <button type="submit" disabled={loading}>
              {loading ? '찾는 중...' : '검색'}
            </button>
          </form>
        )}

        {error && <p className="error">{error}</p>}
      </header>

      <main>
        {searchedArtist && (
          <div className="searched-artist">
            <img src={searchedArtist.imageUrl} alt={searchedArtist.name} />
            <h2>{searchedArtist.name}</h2>
          </div>
        )}
        {/* ▼▼▼ 대표곡 목록을 표시하는 부분을 추가하세요 ▼▼▼ */}
        <div className="top-tracks">
              <h3>Top Tracks on Spotify</h3>
              <ol>
                {topTracks.map((track) => (
                  <li key={track.url}>
                    <a href={track.url} target="_blank" rel="noopener noreferrer">
                      {track.name}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            {/* ▲▲▲ 대표곡 목록을 표시하는 부분을 추가하세요 ▲▲▲ */}
        {recommendations.length > 0 && (
          <div className="playlist-save-container">
            <button onClick={handleSavePlaylist} className="save-playlist-button">
              추천곡을 내 플레이리스트로 저장하기
            </button>
          </div>
        )}

        <div className="recommendations">
          {recommendations.map((genre) => (
            <div key={genre.name} className="genre-card">
              <h3>{genre.name}</h3>
              <p>{genre.description}</p>
              <ul>
                {genre.artists.map((artist) => (
                  <li key={artist.spotifyTrackId}>{artist.artistName}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
      

<footer className="App-footer">
  {/* ▼▼▼ 이 부분을 교체하세요 ▼▼▼ */}
  <p>© {new Date().getFullYear()} Genre Finder. All Rights Reserved.</p>
  <p>Powered by Spotify. All music data and images are properties of Spotify AB.</p>
  {/* ▲▲▲ 이 부분을 교체하세요 ▲▲▲ */}
</footer>
    </div>
  );
}

export default App;