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

function App() {
  const [query, setQuery] = useState('');
  const [searchedArtist, setSearchedArtist] = useState<Artist | null>(null);
  const [recommendations, setRecommendations] = useState<GenreRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // ▼▼▼ 페이지 로드 시 토큰 확인 로직 ▼▼▼
  useEffect(() => {
    const hash = window.location.hash
      .substring(1)
      .split('&')
      .reduce((initial, item) => {
        if (item) {
          var parts = item.split('=');
          initial[parts[0]] = decodeURIComponent(parts[1]);
        }
        return initial;
      }, {} as any);
    
    // URL에서 토큰 정보를 가져오거나 로컬 스토리지에서 가져옴
    const tokenFromUrl = new URLSearchParams(window.location.search).get('access_token');
    const tokenFromStorage = localStorage.getItem('spotify_access_token');

    if (tokenFromUrl) {
        localStorage.setItem('spotify_access_token', tokenFromUrl);
        setAccessToken(tokenFromUrl);
        // URL에서 토큰을 제거하여 주소를 깔끔하게 만듭니다.
        window.history.pushState({}, document.title, "/"); 
    } else if (tokenFromStorage) {
        setAccessToken(tokenFromStorage);
    }
  }, []);
  // ▲▲▲ 페이지 로드 시 토큰 확인 로직 ▲▲▲

  const handleLogin = () => {
    // 백엔드의 로그인 API로 리디렉션
    window.location.href = 'https://genre-finder-backend.onrender.com/api/login';
  };

  const handleLogout = () => {
    setAccessToken(null);
    localStorage.removeItem('spotify_access_token');
    // 페이지를 새로고침하여 초기 상태로 돌아갑니다.
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

    try {
      const response = await axios.post('https://genre-finder-backend.onrender.com/api/recommend-genres', { 
        query,
        accessToken // 요청 시 accessToken 포함
      });
      setSearchedArtist(response.data.searchedArtist);
      setRecommendations(response.data.aiRecommendations);
    } catch (err: any) {
      setError(err.response?.data?.error || '추천 정보를 가져오는 데 실패했습니다. 아티스트 이름을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // ▼▼▼ 플레이리스트 저장 핸들러 추가 ▼▼▼
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
  // ▲▲▲ 플레이리스트 저장 핸들러 추가 ▲▲▲

  return (
    <div className="App">
      <header className="App-header">
        {/* ▼▼▼ 로그인 상태에 따른 UI 변경 ▼▼▼ */}
        {accessToken ? (
          <button onClick={handleLogout} className="logout-button">Logout</button>
        ) : (
          <button onClick={handleLogin} className="login-button">Login with Spotify</button>
        )}
        {/* ▲▲▲ 로그인 상태에 따른 UI 변경 ▲▲▲ */}

        <h1>Genre Finder</h1>
        <p>AI가 당신의 취향에 맞는 새로운 음악 장르를 찾아드립니다.</p>
        
        {accessToken && (
          <form onSubmit={handleSearch}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="좋아하는 아티스트를 입력하세요"
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
        
        {recommendations.length > 0 && (
          // ▼▼▼ 플레이리스트 저장 버튼 추가 ▼▼▼
          <div className="playlist-save-container">
            <button onClick={handleSavePlaylist} className="save-playlist-button">
              추천곡을 내 플레이리스트로 저장하기
            </button>
          </div>
          // ▲▲▲ 플레이리스트 저장 버튼 추가 ▲▲▲
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
    </div>
  );
}

export default App;