// frontend/src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import axios /* Removed AxiosError import */ from 'axios'; // AxiosError 임포트 제거
import './App.css'; 

// --- 타입 정의 ---
interface Artist { name: string; imageUrl?: string; }
interface RecommendedArtist { artistName?: string; spotifyTrackId: string; }
interface GenreRecommendation { name: string; description: string; artists?: RecommendedArtist[]; imageUrl?: string | null; }
interface Track { name: string; url: string; }

// --- Loader 컴포넌트 ---
const Loader = () => ( <div className="flex justify-center items-center py-10"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500"></div></div> );

// --- API 기본 URL ---
const API_BASE_URL = 'https://genre-finder-backend.onrender.com';

function App() {
  // --- 상태 변수 ---
  const [query, setQuery] = useState(''); // setQuery가 사용됨에도 오류가 뜬다면 빌드 캐시 문제일 수 있음
  const [searchedArtist, setSearchedArtist] = useState<Artist | null>(null);
  const [recommendations, setRecommendations] = useState<GenreRecommendation[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]); // JSX에서 사용됨
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [tokenExpiryTime, setTokenExpiryTime] = useState<number | null>(null);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);

  // --- 로그아웃 함수 ---
  const handleLogout = useCallback(() => {
    console.log("handleLogout called. Clearing all token states and storage.");
    setAccessToken(null); setRefreshToken(null); setTokenExpiryTime(null);
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
    window.location.href = '/';
  }, []);

  // --- 토큰 관리 ---
  useEffect(() => {
    console.log("useEffect: Checking for tokens...");
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('access_token');
    const refreshFromUrl = params.get('refresh_token');
    const expiresInFromUrl = params.get('expires_in');

    const tokenFromStorage = localStorage.getItem('spotify_access_token');
    const refreshFromStorage = localStorage.getItem('spotify_refresh_token');
    const expiryFromStorage = localStorage.getItem('spotify_token_expiry');

    let loadedToken: string | null = null;
    let loadedRefresh: string | null = null;
    let loadedExpiry: number | null = null;

    if (tokenFromUrl && refreshFromUrl && expiresInFromUrl) {
      const expiryTimestamp = Date.now() + (parseInt(expiresInFromUrl, 10) - 60) * 1000;
      console.log(`useEffect: Token found in URL. Expires In: ${expiresInFromUrl}s, Calculated Expiry: ${new Date(expiryTimestamp)}`);
      localStorage.setItem('spotify_access_token', tokenFromUrl);
      localStorage.setItem('spotify_refresh_token', refreshFromUrl);
      localStorage.setItem('spotify_token_expiry', expiryTimestamp.toString());
      loadedToken = tokenFromUrl;
      loadedRefresh = refreshFromUrl;
      loadedExpiry = expiryTimestamp;
      window.history.pushState({}, document.title, window.location.pathname);
    } else if (tokenFromStorage && refreshFromStorage && expiryFromStorage) {
      const expiryTimestamp = parseInt(expiryFromStorage, 10);
      if (!isNaN(expiryTimestamp)) {
        loadedToken = tokenFromStorage;
        loadedRefresh = refreshFromStorage;
        loadedExpiry = expiryTimestamp;
        console.log(`useEffect: Token loaded from storage. Expires at: ${new Date(expiryTimestamp)}`);
      } else {
        console.error("useEffect: Invalid expiry time found in storage. Clearing tokens.");
        handleLogout();
      }
    } else {
         console.log("useEffect: No token found in URL or storage.");
    }

    if (loadedToken && loadedExpiry && Date.now() < loadedExpiry) {
      console.log("useEffect: Setting valid token state.");
      setAccessToken(loadedToken);
      setRefreshToken(loadedRefresh);
      setTokenExpiryTime(loadedExpiry);
    } else if (loadedToken && loadedExpiry && Date.now() >= loadedExpiry) {
      console.warn("useEffect: Token from storage is expired. Will attempt refresh on next API call.");
       setAccessToken(loadedToken); // 만료되었어도 일단 설정
       setRefreshToken(loadedRefresh);
       setTokenExpiryTime(loadedExpiry);
    } else if (!loadedToken) {
        console.log("useEffect: No valid token loaded, user needs to login.");
    }

  }, [handleLogout]); // refreshAccessToken 제거됨 (아래 정의)

  // --- 토큰 갱신 함수 ---
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (isRefreshingToken) {
        console.warn("Refresh already in progress.");
        await new Promise(resolve => setTimeout(resolve, 1500));
        return accessToken;
    }
    if (!refreshToken) {
      console.error("No refresh token available. Logging out.");
      handleLogout();
      return null;
    }

    console.log("Attempting to refresh access token using refresh token:", refreshToken.substring(0,5)+"...");
    setIsRefreshingToken(true);
    let newAccessToken: string | null = null;
    try {
      const response = await axios.post(`${API_BASE_URL}/api/refresh_token`, { refreshToken });
      const { accessToken: receivedToken, expiresIn } = response.data;
      if (receivedToken && expiresIn) {
        const newExpiryTimestamp = Date.now() + (expiresIn - 60) * 1000;
        localStorage.setItem('spotify_access_token', receivedToken);
        localStorage.setItem('spotify_token_expiry', newExpiryTimestamp.toString());
        setAccessToken(receivedToken);
        setTokenExpiryTime(newExpiryTimestamp);
        newAccessToken = receivedToken;
        console.log("Access token refreshed successfully. New expiry:", new Date(newExpiryTimestamp));
      } else {
        console.error("Invalid response from refresh token endpoint:", response.data);
        throw new Error("Invalid response structure from refresh token endpoint");
      }
    } catch (err: any) {
      console.error("Failed to refresh access token:", err.response?.data || err.message || err);
      handleLogout();
    } finally {
        setIsRefreshingToken(false);
        console.log("Token refresh process finished.");
    }
    return newAccessToken;
  }, [refreshToken, handleLogout, isRefreshingToken, accessToken]);

  // --- API 요청 래퍼 함수 ---
  const makeApiRequest = useCallback(async (endpoint: string, data: any): Promise<any> => {
    let currentToken = accessToken;

    console.log(`[makeApiRequest] Requesting ${endpoint}. Token expiry: ${tokenExpiryTime ? new Date(tokenExpiryTime) : 'N/A'}`);

    if (!tokenExpiryTime || Date.now() >= tokenExpiryTime) {
      console.warn(`[makeApiRequest] Token expired or invalid (${tokenExpiryTime ? new Date(tokenExpiryTime) : 'N/A'}). Refreshing...`);
      currentToken = await refreshAccessToken();
      if (!currentToken) {
          console.error("[makeApiRequest] Token refresh failed. Aborting request.");
          throw new Error("Failed to refresh authentication. Please log in again.");
      }
      console.log("[makeApiRequest] Token refreshed before request.");
    } else if (!currentToken) {
        console.error("[makeApiRequest] No access token available.");
         throw new Error("No access token available. Please log in.");
    }

    const requestData = { ...data, accessToken: currentToken };

    try {
      console.log(`[makeApiRequest] Sending POST to ${endpoint} with token prefix: ${currentToken?.substring(0,5)}`);
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, requestData);
      console.log(`[makeApiRequest] Request to ${endpoint} successful.`);
      return response.data;
    } catch (err) {
      console.error(`[makeApiRequest] Initial request to ${endpoint} failed:`, err);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        console.warn("[makeApiRequest] Received 401 Unauthorized. Attempting force refresh...");
        currentToken = await refreshAccessToken();
        if (currentToken) {
          console.log("[makeApiRequest] Force refresh successful. Retrying request...");
          requestData.accessToken = currentToken;
          try {
             const retryResponse = await axios.post(`${API_BASE_URL}${endpoint}`, requestData);
             console.log(`[makeApiRequest] Retry request to ${endpoint} successful.`);
             return retryResponse.data;
          } catch(retryErr: any) {
             console.error("[makeApiRequest] Retry request failed after refresh:", retryErr.response?.data || retryErr.message || retryErr);
             handleLogout();
             throw new Error("Failed to complete request even after token refresh. Please log in again.");
          }
        } else {
           console.error("[makeApiRequest] Force refresh failed after 401.");
           throw new Error("Token refresh failed after 401. Please log in again.");
        }
      } else {
        throw err;
      }
    }
  }, [accessToken, tokenExpiryTime, refreshAccessToken, handleLogout]);


  // --- 검색 실행 함수 ---
  const runSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setError('아티스트/곡명을 입력해주세요.'); return; }
    console.log("[runSearch] Starting search for:", searchQuery);
    setLoading(true); setError('');
    setSearchedArtist(null); setRecommendations([]); setTopTracks([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const data = await makeApiRequest('/api/recommend-genres', { query: searchQuery });
      console.log("[runSearch] Search API call successful.");
      setSearchedArtist(data.searchedArtist || null);
      setRecommendations(data.aiRecommendations || []);
      setTopTracks(data.topTracks || []);
    } catch (err: any) {
      console.error("[runSearch] Search ultimately failed:", err);
      setError(err.message || '추천 정보를 가져오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [makeApiRequest]);


  // --- Spotify 로그인 핸들러 ---
  const handleLogin = () => {
       console.log("Redirecting to login...");
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
      setQuery(artistName); // This usage justifies keeping setQuery
      runSearch(artistName);
    }
  };

  // --- 플레이리스트 저장 핸들러 ---
  const handleSavePlaylist = useCallback(async () => {
    if (!recommendations.length || !searchedArtist) { alert('먼저 아티스트를 검색해주세요.'); return; }

    const trackIds = recommendations.flatMap(g => g.artists || []).map(a => a.spotifyTrackId).filter(id => !!id);
    if (trackIds.length === 0) { alert('저장할 추천곡 정보가 없습니다.'); return; }

    setLoading(true); setError('');
    console.log("[handleSavePlaylist] Saving playlist for:", searchedArtist.name);

    try {
      const data = await makeApiRequest('/api/save-playlist', {
        trackIds,
        artistName: searchedArtist.name
      });
      alert(`플레이리스트가 성공적으로 생성되었습니다! Spotify에서 확인해보세요.\nURL: ${data.playlistUrl}`);
      console.log("[handleSavePlaylist] Playlist saved successfully.");
    } catch (err: any) {
      console.error("[handleSavePlaylist] Save playlist ultimately failed:", err);
      setError(err.message || '플레이리스트 생성에 실패했습니다.');
    } finally {
        setLoading(false);
    }
  }, [recommendations, searchedArtist, makeApiRequest]);


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
              onChange={(e) => setQuery(e.target.value)} // setQuery is used here
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
            {/* topTracks is used here */}
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
        {/* handleSavePlaylist is used here */}
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
                              {/* handleArtistClick and artistName are used here */}
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