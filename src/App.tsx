// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';
// './App.css' 파일이 frontend/src 폴더 바로 안에 있는지 확인해주세요.
// 파일 위치나 이름이 다르면 이 경로를 수정해야 합니다.
import './App.css'; 

// 타입 정의
interface Artist {
  name: string;
  imageUrl?: string; // Optional: 이미지가 없을 수도 있음
}
interface RecommendedArtist {
  artistName?: string; // Optional: 이름이 없을 수도 있음
  spotifyTrackId: string;
}
interface GenreRecommendation {
  name: string;
  description: string;
  artists?: RecommendedArtist[]; // Optional: 아티스트 목록이 없을 수도 있음
  imageUrl?: string; // Optional: 이미지가 없을 수도 있음
}
interface Track {
  name: string;
  url: string;
}

// Loader 컴포넌트 (별도 파일로 분리하는 것이 좋지만, 임시로 여기에 정의)
const Loader = () => (
  <div className="loader"><div></div><div></div><div></div><div></div></div>
);


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
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const response = await axios.post('https://genre-finder-backend.onrender.com/api/recommend-genres', {
        query: searchQuery,
        accessToken
      });
      // 데이터가 없을 경우를 대비해 항상 빈 배열/null을 보장
      setSearchedArtist(response.data.searchedArtist || null);
      setRecommendations(response.data.aiRecommendations || []);
      setTopTracks(response.data.topTracks || []);
    } catch (err: any) {
      setError(err.response?.data?.error || '추천 정보를 가져오는 데 실패했습니다.');
      console.error("Search Error:", err); // 콘솔에 상세 에러 출력
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  const handleArtistClick = (artistName?: string) => { // artistName이 없을 수도 있음을 명시
    if (artistName) { // 이름이 있을 때만 검색 실행
      setQuery(artistName);
      runSearch(artistName);
    }
  };

  const handleSavePlaylist = async () => {
    if (!accessToken || !recommendations.length || !searchedArtist) {
      alert('먼저 아티스트를 검색해주세요.');
      return;
    }
    // trackId가 있는 아티스트만 필터링
    const trackIds = recommendations
        .flatMap(genre => genre.artists || []) // artists가 없으면 빈 배열
        .map(artist => artist.spotifyTrackId)
        .filter(id => !!id); // id가 있는 것만 필터링

    if (trackIds.length === 0) {
      alert('저장할 추천곡 정보가 없습니다.');
      return;
    }

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
        {loading && <Loader />} {/* 로딩 중일 때 Loader 표시 */}

        {/* 검색된 아티스트 정보 표시 (데이터가 있을 때만) */}
        {searchedArtist && (
          <div className="search-result-container">
            <div className="searched-artist">
              <img src={searchedArtist.imageUrl || 'https://via.placeholder.com/300'} alt={searchedArtist.name || 'Artist'} />
              <h2>{searchedArtist.name || 'Unknown Artist'}</h2>
            </div>
            {/* 대표곡 목록 표시 (데이터가 있을 때만) */}
            {topTracks && topTracks.length > 0 && (
              <div className="top-tracks">
                <h3>Top Tracks on Spotify</h3>
                <ol>
                  {topTracks.map((track) => (
                    <li key={track.url || track.name}> {/* url이 없을 경우 name을 key로 사용 */}
                      <a href={track.url} target="_blank" rel="noopener noreferrer">
                        {track.name || 'Unknown Track'}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* 추천 장르 목록이 있고 로딩 중이 아닐 때만 저장 버튼 표시 */}
        {!loading && recommendations.length > 0 && (
          <div className="playlist-save-container">
            <button onClick={handleSavePlaylist} className="save-playlist-button">
              <svg viewBox="0 0 168 168" className="spotify-icon">
                <path fill="currentColor" d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.25 37.494 83.742 83.743 83.742 46.249 0 83.744-37.492 83.744-83.742C167.74 37.77 130.245.277 83.996.277zM122.16 120.844c-1.402 2.336-4.515 3.086-6.852 1.684-19.102-11.52-43.045-14.094-71.328-7.727-2.78.61-5.468-1.14-6.078-3.92-.61-2.78 1.14-5.468 3.92-6.078 30.735-6.852 57.03-3.996 78.473 8.945 2.336 1.402 3.086 4.515 1.684 6.852zm8.586-24.59c-1.742 2.898-5.586 3.84-8.484 2.098-21.492-12.985-53.75-16.7-79.094-9.195-3.414.992-6.945-1.125-7.938-4.539-.992-3.414 1.125-6.945 4.539-7.938 28.328-8.234 63.68-4.14 87.82 10.64 2.898 1.742 3.84 5.586 2.098 8.484zm1.14-25.532c-25.53-15.01-67.203-16.33-93.594-9.012-4.023 1.125-8.226-1.5-9.35-5.523-1.125-4.024 1.5-8.227 5.523-9.352 29.93-8.086 75.63-6.524 104.58 10.43 3.555 2.086 4.742 6.773 2.656 10.328-2.086 3.554-6.773 4.742-10.328 2.656z"></path>
              </svg>
              추천곡을 내 플레이리스트로 저장하기
            </button>
          </div>
        )}

        {/* 추천 장르 카드 목록 렌더링 (로딩 중 아닐 때만) */}
        {!loading && recommendations.length > 0 && (
          <div className="recommendations">
            {recommendations.map((genre) => (
              <div key={genre.name} className="genre-card">
                {/* 좌측: 장르명, 이미지 (이미지 없으면 기본 이미지) */}
                <div className="genre-column genre-identity">
                  <h3>{genre.name || 'Unknown Genre'}</h3>
                  {/* 이미지가 있을 때만 img 태그 렌더링 */}
                  {genre.imageUrl ? (
                    <img src={genre.imageUrl} alt={genre.name || 'Genre'} className="genre-image" />
                  ) : (
                    <div className="genre-image-placeholder">No Image</div> // 이미지가 없을 때 대체 텍스트
                  )}
                </div>
                {/* 가운데: 장르 설명 */}
                <div className="genre-column genre-description">
                  <p>{genre.description || 'No description available.'}</p>
                </div>
                {/* 우측: 대표 아티스트 목록 (목록이 있을 때만) */}
                <div className="genre-column genre-artists">
                  <h4>Representative Artists</h4>
                  {/* artists 배열이 존재하고 비어있지 않은지 확인 */}
                  {(genre.artists && genre.artists.length > 0) ? (
                    <ul>
                      {genre.artists.map((artist) => (
                        <li key={artist.spotifyTrackId || artist.artistName}> {/* ID 없으면 이름 사용 */}
                          <button onClick={() => handleArtistClick(artist.artistName)} className="artist-link-button">
                            {artist.artistName || 'Unknown Artist'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No representative artists found.</p> // 아티스트 없으면 메시지 표시
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="App-footer">
        <p>© {new Date().getFullYear()} Genre Finder. All Rights Reserved.</p>
        <p>Powered by Spotify. All music data and images are properties of Spotify AB.</p>
      </footer>
    </div>
  );
}

export default App;

