// frontend/src/App.tsx
import { useState, useEffect, useCallback } from 'react'; // useCallback 추가
import axios, { AxiosError } from 'axios';
// './App.css' 파일이 frontend/src 폴더 바로 안에 있는지 확인해주세요.
import './App.css'; 

// --- 타입 정의 ---
interface Artist { name: string; imageUrl?: string; }
interface RecommendedArtist { artistName?: string; spotifyTrackId: string; }
interface GenreRecommendation { name: string; description: string; artists?: RecommendedArtist[]; imageUrl?: string | null; }
interface Track { name: string; url: string; }

// --- Loader 컴포넌트 ---
const Loader = () => ( <div className="flex justify-center items-center py-10"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500"></div></div> ); // border-spotify-green -> border-green-500 (표준 Tailwind)

// --- API 기본 URL ---
const API_BASE_URL = 'https://genre-finder-backend.onrender.com';

function App() {
  // --- 상태 변수 ---
  const [query, setQuery] = useState('');
  const [searchedArtist, setSearchedArtist] = useState<Artist | null>(null);
  const [recommendations, setRecommendations] = useState<GenreRecommendation[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null); // Refresh Token 상태 추가
  const [tokenExpiryTime, setTokenExpiryTime] = useState<number | null>(null); // 토큰 만료 시간 상태 추가

  // --- 토큰 관리 ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('access_token');
    const refreshFromUrl = params.get('refresh_token');
    const expiresInFromUrl = params.get('expires_in'); // Spotify는 expires_in 으로 전달

    const tokenFromStorage = localStorage.getItem('spotify_access_token');
    const refreshFromStorage = localStorage.getItem('spotify_refresh_token');
    const expiryFromStorage = localStorage.getItem('spotify_token_expiry');

    if (tokenFromUrl && refreshFromUrl && expiresInFromUrl) {
      // 토큰 만료 시간 계산 (현재 시간 + 만료 시간(초) * 1000)
      const expiryTimestamp = Date.now() + parseInt(expiresInFromUrl, 10) * 1000;
      // 로컬 스토리지에 토큰 정보 저장
      localStorage.setItem('spotify_access_token', tokenFromUrl);
      localStorage.setItem('spotify_refresh_token', refreshFromUrl);
      localStorage.setItem('spotify_token_expiry', expiryTimestamp.toString());
      // 상태 업데이트
      setAccessToken(tokenFromUrl);
      setRefreshToken(refreshFromUrl);
      setTokenExpiryTime(expiryTimestamp);
      // URL에서 토큰 정보 제거
      window.history.pushState({}, document.title, window.location.pathname);
    } else if (tokenFromStorage && refreshFromStorage && expiryFromStorage) {
      // 로컬 스토리지에 정보가 있으면 상태 업데이트
      setAccessToken(tokenFromStorage);
      setRefreshToken(refreshFromStorage);
      setTokenExpiryTime(parseInt(expiryFromStorage, 10));
    }
  }, []); // 마운트 시 한 번만 실행

    // --- 로그아웃 함수 ---
    const handleLogout = useCallback(() => { // useCallback 추가
        setAccessToken(null); setRefreshToken(null); setTokenExpiryTime(null);
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expiry');
        // 홈으로 리디렉션하며 상태 초기화 (window.location.reload() 대신 사용 가능)
        window.location.href = '/';
    }, []); // 의존성 없음

  // --- 토큰 갱신 함수 ---
  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) {
      console.error("No refresh token available for refresh.");
      handleLogout(); // 로그아웃 처리
      return null;
    }
    console.log("Attempting to refresh access token...");
    try {
      const response = await axios.post(`${API_BASE_URL}/api/refresh_token`, { refreshToken });
      const { accessToken: newAccessToken, expiresIn } = response.data; // 백엔드 응답 필드명 확인
      if (newAccessToken && expiresIn) {
        const newExpiryTimestamp = Date.now() + expiresIn * 1000;
        localStorage.setItem('spotify_access_token', newAccessToken);
        localStorage.setItem('spotify_token_expiry', newExpiryTimestamp.toString());
        // Refresh Token은 그대로 유지
        setAccessToken(newAccessToken);
        setTokenExpiryTime(newExpiryTimestamp);
        console.log("Access token refreshed successfully.");
        return newAccessToken; // 갱신된 토큰 반환
      } else {
        // 백엔드 응답 형식이 잘못된 경우
        throw new Error("Invalid response structure from refresh token endpoint");
      }
    } catch (err) {
      console.error("Failed to refresh access token:", err);
      // 갱신 실패 시 로그아웃
      handleLogout();
      return null;
    }
  }, [refreshToken, handleLogout]); // refreshToken, handleLogout 의존성 추가

  // --- API 요청 래퍼 함수 (토큰 갱신 로직 포함) ---
  const makeApiRequest = useCallback(async (endpoint: string, data: any) => {
    let currentAccessToken = accessToken; // 현재 상태의 토큰 사용

    // 토큰 만료 여부 확인 (만료 1분 전)
    if (tokenExpiryTime && Date.now() > tokenExpiryTime - 60000) {
      console.log("Token expired or nearing expiry, refreshing...");
      currentAccessToken = await refreshAccessToken(); // 토큰 갱신 시도
      if (!currentAccessToken) {
          // 갱신 실패 시 에러 발생 (handleLogout이 이미 호출됨)
          throw new Error("Token refresh failed. Please log in again.");
      }
      // 갱신된 토큰으로 data 업데이트 (data 객체에 accessToken 키가 있다고 가정)
      data.accessToken = currentAccessToken;
    } else if (!currentAccessToken) {
        // Access Token 자체가 없는 경우
         throw new Error("No access token available. Please log in.");
    }

    try {
      // 실제 API 요청 실행 (현재 또는 갱신된 토큰 사용)
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, { ...data, accessToken: currentAccessToken });
      return response.data;
    } catch (err) {
      // API 요청 실패 시
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        // 401 오류(토큰 만료) 발생 시, 재갱신 시도 (만료 시간 체크와 별개로)
        console.log("Received 401 Unauthorized, attempting token refresh again...");
        currentAccessToken = await refreshAccessToken();
        if (currentAccessToken) {
          console.log("Retrying API request with newly refreshed token...");
          // 갱신된 토큰으로 데이터 업데이트 및 재시도 (단 한번만)
          data.accessToken = currentAccessToken;
          try {
             const retryResponse = await axios.post(`${API_BASE_URL}${endpoint}`, { ...data, accessToken: currentAccessToken });
             return retryResponse.data;
          } catch(retryErr) {
             console.error("API request failed on retry after refresh:", retryErr);
             throw retryErr; // 재시도 실패 시 에러 전파
          }
        } else {
           throw new Error("Token refresh failed after 401. Please log in again.");
        }
      } else {
        // 401 외 다른 Axios 오류 또는 일반 오류
        console.error("API request failed:", err);
        throw err; // 원래 오류 전파
      }
    }
  }, [accessToken, refreshToken, tokenExpiryTime, refreshAccessToken, handleLogout]); // 의존성 배열 업데이트


  // --- 검색 실행 함수 ---
  const runSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setError('아티스트/곡명을 입력해주세요.'); return; }
    setLoading(true);
    setError('');
    setSearchedArtist(null); setRecommendations([]); setTopTracks([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      // makeApiRequest 사용
      const data = await makeApiRequest('/api/recommend-genres', {
        query: searchQuery
        // accessToken은 makeApiRequest 내부에서 처리
      });
      setSearchedArtist(data.searchedArtist || null);
      setRecommendations(data.aiRecommendations || []);
      setTopTracks(data.topTracks || []);
    } catch (err: any) {
      // makeApiRequest에서 던져진 최종 에러 처리
      setError(err.message || '추천 정보를 가져오는 데 실패했습니다.');
      console.error("Search ultimately failed:", err);
    } finally {
      setLoading(false);
    }
  }, [makeApiRequest]); // makeApiRequest 의존성 추가


  // --- Spotify 로그인 핸들러 ---
  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/login`;
  };


  // --- 폼 제출 핸들러 ---
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  // --- 아티스트 클릭 핸들러 ---
  const handleArtistClick = (artistName?: string) => {
    if (artistName) {
      setQuery(artistName);
      runSearch(artistName);
    }
  };

  // --- 플레이리스트 저장 핸들러 ---
  const handleSavePlaylist = useCallback(async () => {
    if (!recommendations.length || !searchedArtist) { alert('먼저 아티스트를 검색해주세요.'); return; }

    const trackIds = recommendations.flatMap(g => g.artists || []).map(a => a.spotifyTrackId).filter(id => !!id);
    if (trackIds.length === 0) { alert('저장할 추천곡 정보가 없습니다.'); return; }

    setLoading(true);
    setError('');

    try {
       // makeApiRequest 사용
      const data = await makeApiRequest('/api/save-playlist', {
        // accessToken은 makeApiRequest 내부에서 처리
        trackIds,
        artistName: searchedArtist.name
      });
      alert(`플레이리스트가 성공적으로 생성되었습니다! Spotify에서 확인해보세요.\nURL: ${data.playlistUrl}`);
    } catch (err: any) {
       // makeApiRequest에서 던져진 최종 에러 처리
      setError(err.message || '플레이리스트 생성에 실패했습니다.');
      console.error("Save playlist ultimately failed:", err);
    } finally {
        setLoading(false);
    }
  }, [recommendations, searchedArtist, makeApiRequest]); // makeApiRequest 의존성 추가


  // --- JSX 렌더링 ---
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
        {loading && <Loader />}
        {!loading && searchedArtist && (
          <div className="search-result-container">
            <div className="searched-artist">
              <img src={searchedArtist.imageUrl || 'https://via.placeholder.com/300'} alt={searchedArtist.name || 'Artist'} />
              <h2>{searchedArtist.name || 'Unknown Artist'}</h2>
            </div>
            {topTracks && topTracks.length > 0 && (
              <div className="top-tracks">
                <h3>Top Tracks on Spotify</h3>
                <ol>
                  {topTracks.map((track) => (
                    <li key={track.url || track.name}>
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
        {!loading && recommendations.length > 0 && (
          <div className="playlist-save-container">
            <button onClick={handleSavePlaylist} className="save-playlist-button">
              <svg viewBox="0 0 168 168" className="spotify-icon">
                <path fill="currentColor" d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.25 37.494 83.742 83.743 83.742 46.249 0 83.744-37.492 83.744-83.742C167.74 37.77 130.245.277 83.996.277zM122.16 120.844c-1.402 2.336-4.515 3.086-6.852 1.684-19.102-11.52-43.045-14.094-71.328-7.727-2.78.61-5.468-1.14-6.078-3.92-.61-2.78 1.14-5.468 3.92-6.078 30.735-6.852 57.03-3.996 78.473 8.945 2.336 1.402 3.086 4.515 1.684 6.852zm8.586-24.59c-1.742 2.898-5.586 3.84-8.484 2.098-21.492-12.985-53.75-16.7-79.094-9.195-3.414.992-6.945-1.125-7.938-4.539-.992-3.414 1.125-6.945 4.539-7.938 28.328-8.234 63.68-4.14 87.82 10.64 2.898 1.742 3.84 5.586 2.098 8.484zm1.14-25.532c-25.53-15.01-67.203-16.33-93.594-9.012-4.023 1.125-8.226-1.5-9.35-5.523-1.125-4.024 1.5-8.227 5.523-9.352 29.93-8.086 75.63-6.524 104.58 10.43 3.555 2.086 4.742 6.773 2.656 10.328-2.086 3.554-6.773 4.742-10.328 2.656z"></path>
              </svg>
              Add to Spotify Playlist
            </button>
          </div>
        )}
        {!loading && recommendations.length > 0 && (
          <div className="recommendations">
            {recommendations.map((genre) => (
              genre && genre.name && (
                <div key={genre.name} className="genre-card">
                  <div className="genre-column genre-identity">
                    <h3>{genre.name}</h3>
                    {genre.imageUrl ? (
                      <img src={genre.imageUrl} alt={genre.name} className="genre-image" />
                    ) : (
                      <div className="genre-image-placeholder">No Image Available</div>
                    )}
                  </div>
                  <div className="genre-column genre-description">
                    <p>{genre.description || 'No description available.'}</p>
                  </div>
                  <div className="genre-column genre-artists">
                    <h4>Representative Artists</h4>
                    {(genre.artists && genre.artists.length > 0) ? (
                      <ul>
                        {genre.artists.map((artist) => (
                          artist && artist.artistName && (
                            <li key={artist.spotifyTrackId || artist.artistName}>
                              <button onClick={() => handleArtistClick(artist.artistName)} className="artist-link-button">
                                {artist.artistName}
                              </button>
                            </li>
                          )
                        ))}
                      </ul>
                    ) : (
                      <p>No representative artists found.</p>
                    )}
                  </div>
                </div>
              )
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