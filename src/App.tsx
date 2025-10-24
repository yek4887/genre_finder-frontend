// frontend/src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react'; // useRef 추가
import axios, { AxiosError } from 'axios';
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
  const [query, setQuery] = useState('');
  const [searchedArtist, setSearchedArtist] = useState<Artist | null>(null);
  const [recommendations, setRecommendations] = useState<GenreRecommendation[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [tokenExpiryTime, setTokenExpiryTime] = useState<number | null>(null);
  const isRefreshingToken = useRef(false); // useRef로 변경하여 리렌더링 방지 및 동시성 제어

  // --- 로그아웃 함수 ---
  const handleLogout = useCallback(() => {
    console.log("[handleLogout] Logging out...");
    setAccessToken(null); setRefreshToken(null); setTokenExpiryTime(null);
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
    window.location.href = '/';
  }, []);

  // --- 토큰 갱신 함수 ---
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // useRef를 사용하여 동시 갱신 시도 방지
    if (isRefreshingToken.current) {
      console.warn("[refreshAccessToken] Refresh already in progress. Waiting...");
      // 간단한 폴링 또는 Promise 기반 대기 메커니즘 추가 가능
      await new Promise(resolve => setTimeout(resolve, 1500)); // 잠시 대기
      return accessToken; // 현재 상태 반환 (갱신 성공 시 업데이트 되어 있을 것임)
    }
    if (!refreshToken) {
      console.error("[refreshAccessToken] No refresh token available. Logging out.");
      handleLogout();
      return null;
    }

    console.log("[refreshAccessToken] Attempting to refresh access token...");
    isRefreshingToken.current = true; // 갱신 시작 플래그
    let newAccessToken: string | null = null;
    try {
      const response = await axios.post(`${API_BASE_URL}/api/refresh_token`, { refreshToken });
      const { accessToken: receivedToken, expiresIn } = response.data;
      if (receivedToken && expiresIn) {
        // 안전 마진 포함 만료 시간 계산 (현재 시간 기준)
        const newExpiryTimestamp = Date.now() + (expiresIn - 60) * 1000;
        localStorage.setItem('spotify_access_token', receivedToken);
        localStorage.setItem('spotify_token_expiry', newExpiryTimestamp.toString());
        // 상태 업데이트
        setAccessToken(receivedToken);
        setTokenExpiryTime(newExpiryTimestamp);
        newAccessToken = receivedToken; // 반환 값 설정
        console.log(`[refreshAccessToken] Success! New expiry: ${new Date(newExpiryTimestamp)}`);
      } else {
        console.error("[refreshAccessToken] Invalid response structure:", response.data);
        throw new Error("Invalid response structure from refresh token endpoint");
      }
    } catch (err: any) {
      console.error("[refreshAccessToken] FAILED:", err.response?.data || err.message || err);
      // 갱신 실패 시 로그아웃
      handleLogout();
    } finally {
        isRefreshingToken.current = false; // 갱신 종료 플래그
        console.log("[refreshAccessToken] Process finished.");
    }
    return newAccessToken; // 성공 시 새 토큰, 실패 시 null
  }, [refreshToken, handleLogout, accessToken]); // accessToken 추가 (갱신 중 대기 시 반환 위함)

  // --- 토큰 관리 (useEffect) ---
  useEffect(() => {
    console.log("useEffect: Checking tokens on mount...");
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('access_token');
    const refreshFromUrl = params.get('refresh_token');
    const expiresInFromUrl = params.get('expires_in');

    const tokenFromStorage = localStorage.getItem('spotify_access_token');
    const refreshFromStorage = localStorage.getItem('spotify_refresh_token');
    const expiryFromStorage = localStorage.getItem('spotify_token_expiry');

    let initialToken: string | null = null;
    let initialRefresh: string | null = null;
    let initialExpiry: number | null = null;

    if (tokenFromUrl && refreshFromUrl && expiresInFromUrl) {
      // URL 우선 처리
      const expiryTimestamp = Date.now() + (parseInt(expiresInFromUrl, 10) - 60) * 1000;
      console.log(`useEffect: Token from URL. Expires In: ${expiresInFromUrl}s, Calculated Expiry: ${new Date(expiryTimestamp)}`);
      localStorage.setItem('spotify_access_token', tokenFromUrl);
      localStorage.setItem('spotify_refresh_token', refreshFromUrl);
      localStorage.setItem('spotify_token_expiry', expiryTimestamp.toString());
      initialToken = tokenFromUrl;
      initialRefresh = refreshFromUrl;
      initialExpiry = expiryTimestamp;
      window.history.pushState({}, document.title, window.location.pathname);
    } else if (tokenFromStorage && refreshFromStorage && expiryFromStorage) {
      // 스토리지 처리
      const expiryTimestamp = parseInt(expiryFromStorage, 10);
      if (!isNaN(expiryTimestamp)) {
        initialToken = tokenFromStorage;
        initialRefresh = refreshFromStorage;
        initialExpiry = expiryTimestamp;
        console.log(`useEffect: Token from storage. Expires at: ${new Date(expiryTimestamp)}`);
      } else {
        console.error("useEffect: Invalid expiry time in storage. Clearing tokens.");
        handleLogout();
        return; // 로그아웃 후 종료
      }
    } else {
         console.log("useEffect: No token found.");
    }

    // 상태 최종 설정 (만료 여부 확인 후)
    if (initialToken && initialExpiry && Date.now() < initialExpiry) {
      console.log("useEffect: Setting valid token state from initial load.");
      setAccessToken(initialToken);
      setRefreshToken(initialRefresh);
      setTokenExpiryTime(initialExpiry);
    } else if (initialToken && initialExpiry && Date.now() >= initialExpiry && initialRefresh) {
      // 로드했지만 만료된 경우 -> 즉시 갱신 시도
      console.warn("useEffect: Token loaded but expired. Attempting immediate refresh.");
      setRefreshToken(initialRefresh); // Refresh Token 먼저 설정
       (async () => {
           await refreshAccessToken(); // await 추가
       })();
    } else if (!initialToken) {
        console.log("useEffect: No valid token loaded. User needs to login.");
    }

  }, [handleLogout, refreshAccessToken]); // 의존성 배열에서 refreshAccessToken 제거 시도 -> 순환 의존성 가능성


  // --- API 요청 래퍼 함수 ---
  const makeApiRequest = useCallback(async (endpoint: string, data: any): Promise<any> => {
    // 함수 호출 시점의 상태를 명확히 하기 위해 상태 변수 다시 읽기
    let currentToken = localStorage.getItem('spotify_access_token'); // 상태 대신 스토리지 직접 읽기 시도
    let currentExpiry = localStorage.getItem('spotify_token_expiry');
    let expiryTimestamp = currentExpiry ? parseInt(currentExpiry, 10) : null;

    console.log(`[makeApiRequest] Requesting ${endpoint}. Current Token from storage prefix: ${currentToken?.substring(0,5)}, Expiry: ${expiryTimestamp ? new Date(expiryTimestamp) : 'N/A'}`);

    // 만료 시간 확인 (Date.now()와 비교) - 만료되었거나 없으면 갱신 시도
    if (!expiryTimestamp || isNaN(expiryTimestamp) || Date.now() >= expiryTimestamp) {
      console.warn(`[makeApiRequest] Token expired or invalid based on time/storage. Refreshing...`);
      currentToken = await refreshAccessToken(); // 갱신 시도, 결과(새 토큰 또는 null)를 currentToken에 저장
      if (!currentToken) {
          console.error("[makeApiRequest] Token refresh FAILED during pre-check. Aborting request.");
          throw new Error("Failed to refresh authentication. Please log in again.");
      }
      console.log("[makeApiRequest] Token refreshed before request. New token prefix:", currentToken.substring(0,5));
    } else if (!currentToken) {
        // 이 경우는 거의 없어야 함 (expiryTimestamp가 있는데 currentToken이 null?)
        console.error("[makeApiRequest] Inconsistent state: Expiry time exists but no access token found in storage. Logging out.");
        handleLogout();
        throw new Error("Authentication error. Please log in again.");
    }

    // 요청 데이터에 현재 유효한(또는 갱신된) 토큰 포함
    const requestData = { ...data, accessToken: currentToken };

    try {
      // 실제 API 요청
      console.log(`[makeApiRequest] Sending POST to ${endpoint} with token prefix: ${currentToken?.substring(0,5)}`);
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, requestData);
      console.log(`[makeApiRequest] Request to ${endpoint} successful.`);
      return response.data; // 성공 시 데이터 반환
    } catch (err) {
      console.error(`[makeApiRequest] Initial request to ${endpoint} FAILED:`, err);
      // 401 오류(토큰 만료) 감지 시 재시도
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        console.warn("[makeApiRequest] Received 401 Unauthorized during API request. Attempting force refresh...");
        currentToken = await refreshAccessToken(); // 강제 갱신
        if (currentToken) {
          console.log("[makeApiRequest] Force refresh successful. Retrying request with new token prefix:", currentToken.substring(0,5));
          requestData.accessToken = currentToken; // 갱신된 토큰으로 업데이트
          try {
             // 재시도 (단 한번)
             const retryResponse = await axios.post(`${API_BASE_URL}${endpoint}`, requestData);
             console.log(`[makeApiRequest] Retry request to ${endpoint} successful.`);
             return retryResponse.data;
          } catch(retryErr: any) {
             console.error("[makeApiRequest] Retry request FAILED after refresh:", retryErr.response?.data || retryErr.message || retryErr);
             handleLogout(); // 재시도 실패 시 로그아웃
             throw new Error("Failed to complete request even after token refresh. Please log in again.");
          }
        } else {
           console.error("[makeApiRequest] Force refresh FAILED after 401.");
           // handleLogout은 refreshAccessToken 내부에서 호출됨
           throw new Error("Token refresh failed after 401. Please log in again.");
        }
      } else if (axios.isAxiosError(err)) {
          // 401 외 다른 Axios 오류
          throw new Error(err.response?.data?.error || `Request failed with status ${err.response?.status}`);
      }
      else {
        // 일반 오류
        throw err;
      }
    }
  }, [accessToken, tokenExpiryTime, refreshToken, refreshAccessToken, handleLogout]); // 의존성 배열 재확인


  // --- 검색 실행 함수 ---
  const runSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setError('아티스트/곡명을 입력해주세요.'); return; }
    console.log("[runSearch] Starting search for:", searchQuery);
    setLoading(true); setError('');
    setSearchedArtist(null); setRecommendations([]); setTopTracks([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      // makeApiRequest 호출 시점의 accessToken 상태는 makeApiRequest 내부에서 처리됨
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
  }, [makeApiRequest, query]); // query 추가 (폼 제출이 아닌 클릭 등으로 호출될 경우 최신 query 반영 위해)


  // --- Spotify 로그인 핸들러 ---
  const handleLogin = () => { /* ... 동일 ... */ };


  // --- 폼 제출 핸들러 ---
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  // --- 아티스트 클릭 핸들러 ---
  const handleArtistClick = (artistName?: string) => { /* ... 동일 ... */ };

  // --- 플레이리스트 저장 핸들러 ---
  const handleSavePlaylist = useCallback(async () => {
    if (!recommendations.length || !searchedArtist) { alert('먼저 아티스트를 검색해주세요.'); return; }

    const trackIds = recommendations.flatMap(g => g.artists || []).map(a => a.spotifyTrackId).filter(id => !!id);
    if (trackIds.length === 0) { alert('저장할 추천곡 정보가 없습니다.'); return; }

    setLoading(true); setError('');
    console.log("[handleSavePlaylist] Saving playlist for:", searchedArtist.name);

    try {
      // makeApiRequest 호출 시점의 accessToken 상태는 makeApiRequest 내부에서 처리됨
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
       {/* ... (헤더, 메인, 푸터 JSX 구조는 이전과 동일) ... */}
       <header className="App-header">
         {accessToken ? (
           <button onClick={handleLogout} className="logout-button">Logout</button>
         ) : (
           <button onClick={handleLogin} className="login-button">Login with Spotify</button>
         )}
         <h1>Genre Finder</h1>
         <p>...</p>
         {accessToken && ( <form onSubmit={handleFormSubmit}> {/* ... 검색 폼 ... */} </form> )}
         {error && <p className="error">{error}</p>}
       </header>
       <main>
           {loading && <Loader />}
           {!loading && searchedArtist && ( <div className="search-result-container"> {/* ... */} </div> )}
           {!loading && recommendations.length > 0 && ( <div className="playlist-save-container"> {/* ... */} </div> )}
           {!loading && recommendations.length > 0 && ( <div className="recommendations"> {/* ... */} </div> )}
       </main>
       <footer className="App-footer"> {/* ... */} </footer>
    </div>
  );
}

export default App;