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
  imageUrl: string;
}
interface Track {
  name: string;
  url: string;
}

function App() {
  const [query, setQuery] = useState('');
  const [searchedArtist, setSearchedArtist] = useState<Artist | null>(null);
  const [recommendations, setRecommendations] = useState<GenreRecommendation[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const tokenFromUrl = new URLSearchParams(window.location.search).get('access_token');
    const tokenFromStorage = localStorage.getItem('spotify_access_token');

    if (tokenFromUrl) {
        localStorage.setItem('spotify_access_token', tokenFromUrl);
        setAccessToken(tokenFromUrl);
        window.history.pushState({}, document.title, "/");
    } else if (tokenFromStorage) {
        setAccessToken(tokenFromStorage);
    }
  }, []);

  const handleLogin = () => {
    window.location.href = 'https://genre-finder-backend.onrender.com/api/login';
  };

  const handleLogout = () => {
    setAccessToken(null);
    localStorage.removeItem('spotify_access_token');
    window.location.reload();
  };

  // ▼▼▼ 핵심 로직이 분리되었습니다 ▼▼▼
  // --- 검색을 실행하는 핵심 로직 ---
  const runSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setError('아티스트/곡명을 입력해주세요.');
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
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 검색 시 화면 상단으로 이동

    try {
      const response = await axios.post('https://genre-finder-backend.onrender.com/api/recommend-genres', {
        query: searchQuery,
        accessToken
      });
      setSearchedArtist(response.data.searchedArtist);
      setRecommendations(response.data.aiRecommendations || []);
      setTopTracks(response.data.topTracks || []);
    } catch (err: any) {
      setError(err.response?.data?.error || '추천 정보를 가져오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // --- 폼 제출 시 호출되는 핸들러 ---
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  // --- 추천 아티스트 클릭 시 호출되는 핸들러 ---
  const handleArtistClick = (artistName: string) => {
    setQuery(artistName); // 검색창 텍스트를 클릭된 아티스트로 변경
    runSearch(artistName); // 해당 아티스트로 즉시 검색 실행
  };
  // ▲▲▲ 핵심 로직이 분리되었습니다 ▲▲▲

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
          // ▼▼▼ onSubmit 핸들러가 수정되었습니다 ▼▼▼
          <form onSubmit={handleFormSubmit}>
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
          <div className="search-result-container">
            <div className="searched-artist">
              <img src={searchedArtist.imageUrl} alt={searchedArtist.name} />
              <h2>{searchedArtist.name}</h2>
            </div>

            {topTracks.length > 0 && (
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
            )}
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="playlist-save-container">
            // frontend/src/App.tsx 파일에서 <button onClick={handleSavePlaylist} ...> 부분을 찾아 교체하세요.

<button onClick={handleSavePlaylist} className="save-playlist-button">
  {/* ▼▼▼ 이 SVG 부분을 아래 코드로 교체하세요 ▼▼▼ */}
  <svg viewBox="0 0 168 168" className="spotify-icon">
    <path fill="currentColor" d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.25 37.494 83.742 83.743 83.742 46.249 0 83.744-37.492 83.744-83.742C167.74 37.77 130.245.277 83.996.277zM122.16 120.844c-1.402 2.336-4.515 3.086-6.852 1.684-19.102-11.52-43.045-14.094-71.328-7.727-2.78.61-5.468-1.14-6.078-3.92-.61-2.78 1.14-5.468 3.92-6.078 30.735-6.852 57.03-3.996 78.473 8.945 2.336 1.402 3.086 4.515 1.684 6.852zm8.586-24.59c-1.742 2.898-5.586 3.84-8.484 2.098-21.492-12.985-53.75-16.7-79.094-9.195-3.414.992-6.945-1.125-7.938-4.539-.992-3.414 1.125-6.945 4.539-7.938 28.328-8.234 63.68-4.14 87.82 10.64 2.898 1.742 3.84 5.586 2.098 8.484zm1.14-25.532c-25.53-15.01-67.203-16.33-93.594-9.012-4.023 1.125-8.226-1.5-9.35-5.523-1.125-4.024 1.5-8.227 5.523-9.352 29.93-8.086 75.63-6.524 104.58 10.43 3.555 2.086 4.742 6.773 2.656 10.328-2.086 3.554-6.773 4.742-10.328 2.656z"></path>
  </svg>
  {/* ▲▲▲ 이 SVG 부분을 위 코드로 교체하세요 ▲▲▲ */}
  추천곡을 내 플레이리스트로 저장하기
</button>
          </div>
        )}

        <div className="recommendations">
          {recommendations.map((genre) => (
            <div key={genre.name} className="genre-card">
              <div className="genre-column genre-identity">
                <h3>{genre.name}</h3>
                {genre.imageUrl && <img src={genre.imageUrl} alt={genre.name} className="genre-image" />}
              </div>
              <div className="genre-column genre-description">
                <p>{genre.description}</p>
              </div>
              {/* ▼▼▼ 이 부분이 수정되었습니다 ▼▼▼ */}
              <div className="genre-column genre-artists">
                <h4>Representative Artists</h4>
                <ul>
                  {genre.artists.map((artist) => (
                    <li key={artist.spotifyTrackId}>
                      <button onClick={() => handleArtistClick(artist.artistName)} className="artist-link-button">
                        {artist.artistName}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {/* ▲▲▲ 이 부분이 수정되었습니다 ▲▲▲ */}
            </div>
          ))}
        </div>
      </main>

      <footer className="App-footer">
        <p>© {new Date().getFullYear()} Genre Finder. All Rights Reserved.</p>
        <p>Powered by Spotify. All music data and images are properties of Spotify AB.</p>
      </footer>
    </div>
  );
}

export default App;