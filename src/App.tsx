// frontend/src/App.tsx
import { useState, useEffect, useCallback } from 'react';
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
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);

  // --- 로그아웃 함수 ---
  const handleLogout = useCallback(() => {
    console.log("handleLogout called. Clearing all token states and storage.");
    setAccessToken(null); setRefreshToken(null); setTokenExpiryTime(null);
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
    window.location.href = '/'; // 홈으로 리디렉션
  }, []);

  // --- 토큰 갱신 함수 ---
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (isRefreshingToken) {
      console.warn("Refresh already in progress. Waiting briefly...");
      // 이미 갱신 중일 때 약간의 대기 후 현재 토큰 반환 (갱신 성공 시 업데이트될 것임)
      await new Promise(resolve => setTimeout(resolve, 1500));
      return accessToken; // 현재 accessToken 상태 반환
    }
    if (!refreshToken) {
      console.error("No refresh token available. Logging out.");
      handleLogout();
      return null;
    }

    console.log("Attempting to refresh access token using refresh token:", refreshToken.substring(0,5)+"...");
    setIsRefreshingToken(true);
    let newAccessToken: string | null = null; // 결과 저장 변수
    try {
      const response = await axios.post(`${API_BASE_URL}/api/refresh_token`, { refreshToken });
      const { accessToken: receivedToken, expiresIn } = response.data;
      if (receivedToken && expiresIn) {
        const newExpiryTimestamp = Date.now() + (expiresIn - 60) * 1000;
        localStorage.setItem('spotify_access_token', receivedToken);
        localStorage.setItem('spotify_token_expiry', newExpiryTimestamp.toString());
        // Refresh Token은 그대로 유지
        setAccessToken(receivedToken); // 상태 업데이트
        setTokenExpiryTime(newExpiryTimestamp); // 상태 업데이트
        newAccessToken = receivedToken; // 반환할 값 설정
        console.log("Access token refreshed successfully. New expiry:", new Date(newExpiryTimestamp));
      } else {
        console.error("Invalid response from refresh token endpoint:", response.data);
        throw new Error("Invalid response structure from refresh token endpoint");
      }
    } catch (err: any) {
      console.error("Failed to refresh access token:", err.response?.data || err.message || err);
      // 갱신 실패 시 로그아웃
      handleLogout();
    } finally {
        setIsRefreshingToken(false);
        console.log("Token refresh process finished."); // 종료 로그
    }
    return newAccessToken; // 성공 시 새 토큰, 실패 시 null 반환
  }, [refreshToken, handleLogout, isRefreshingToken, accessToken]); // accessToken 추가 (갱신 중 반환 위해)


  // --- 토큰 관리 (useEffect 수정) ---
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
      // URL에서 가져온 경우
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
      // 로컬 스토리지에서 가져온 경우
      const expiryTimestamp = parseInt(expiryFromStorage, 10);
      if (!isNaN(expiryTimestamp)) {
        loadedToken = tokenFromStorage;
        loadedRefresh = refreshFromStorage;
        loadedExpiry = expiryTimestamp;
        console.log(`useEffect: Token loaded from storage. Expires at: ${new Date(expiryTimestamp)}`);
      } else {
        console.error("useEffect: Invalid expiry time found in storage. Clearing tokens.");
        handleLogout(); // 잘못된 값 있으면 로그아웃
      }
    } else {
         console.log("useEffect: No token found in URL or storage.");
    }

    // 상태 업데이트 전에 만료 시간 확인
    if (loadedToken && loadedExpiry && Date.now() < loadedExpiry) {
      // 유효한 토큰이면 상태 업데이트
      console.log("useEffect: Setting valid token state.");
      setAccessToken(loadedToken);
      setRefreshToken(loadedRefresh);
      setTokenExpiryTime(loadedExpiry);
    } else if (loadedToken && loadedExpiry && Date.now() >= loadedExpiry) {
      // 로드했지만 이미 만료된 경우 -> 즉시 갱신 시도
      console.warn("useEffect: Token from storage is expired. Attempting immediate refresh.");
       setRefreshToken(loadedRefresh); // Refresh Token은 먼저 설정해야 함
       // async 함수를 직접 호출할 수 없으므로 IIFE 사용
       (async () => {
           await refreshAccessToken();
       })();
    } else if (!loadedToken) {
        console.log("useEffect: No valid token loaded, user needs to login.");
        // 토큰이 아예 없는 경우 (로그아웃 상태 유지)
    }

  }, [handleLogout, refreshAccessToken]); // refreshAccessToken 의존성 추가


  // --- API 요청 래퍼 함수 ---
  const makeApiRequest = useCallback(async (endpoint: string, data: any): Promise<any> => {
    let currentToken = accessToken; // 현재 상태의 토큰으로 시작

    console.log(`[makeApiRequest] Requesting ${endpoint}. Current token expiry: ${tokenExpiryTime ? new Date(tokenExpiryTime) : 'N/A'}`);

    // 만료 시간 확인 (Date.now()와 비교) - 만료되었거나 null이면 갱신 시도
    if (!tokenExpiryTime || Date.now() >= tokenExpiryTime) {
      console.warn(`[makeApiRequest] Token expired or invalid (${tokenExpiryTime ? new Date(tokenExpiryTime) : 'N/A'}). Refreshing...`);
      currentToken = await refreshAccessToken();
      if (!currentToken) {
          console.error("[makeApiRequest] Token refresh failed. Aborting request.");
          // 사용자에게 알릴 수 있는 에러 throw
          throw new Error("Failed to refresh authentication. Please log in again.");
      }
      console.log("[makeApiRequest] Token refreshed before request.");
    } else if (!currentToken) {
        console.error("[makeApiRequest] No access token available, though expiry time might be valid?");
         throw new Error("No access token available. Please log in.");
    }

    // 요청 데이터에 현재 유효한(또는 갱신된) 토큰 포함
    const requestData = { ...data, accessToken: currentToken };

    try {
      console.log(`[makeApiRequest] Sending POST to ${endpoint} with token prefix: ${currentToken?.substring(0,5)}`);
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, requestData);
      console.log(`[makeApiRequest] Request to ${endpoint} successful.`);
      return response.data;
    } catch (err) {
      console.error(`[makeApiRequest] Initial request to ${endpoint} failed:`, err);
      // 401 오류(토큰 만료) 감지 시 재시도
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        console.warn("[makeApiRequest] Received 401 Unauthorized during API request. Attempting force refresh...");
        currentToken = await refreshAccessToken(); // 강제 갱신
        if (currentToken) {
          console.log("[makeApiRequest] Force refresh successful. Retrying request...");
          requestData.accessToken = currentToken; // 갱신된 토큰으로 업데이트
          try {
             const retryResponse = await axios.post(`${API_BASE_URL}${endpoint}`, requestData);
             console.log(`[makeApiRequest] Retry request to ${endpoint} successful.`);
             return retryResponse.data;
          } catch(retryErr: any) {
             console.error("[makeApiRequest] Retry request failed after refresh:", retryErr.response?.data || retryErr.message || retryErr);
             // 재시도 실패 시 로그아웃 또는 명확한 에러 메시지
             handleLogout(); // 재시도 실패 시 로그아웃
             throw new Error("Failed to complete request even after token refresh. Please log in again.");
          }
        } else {
           console.error("[makeApiRequest] Force refresh failed after 401.");
           // handleLogout은 refreshAccessToken 내부에서 호출됨
           throw new Error("Token refresh failed after 401. Please log in again.");
        }
      } else {
        // 401 외 다른 Axios 오류 또는 일반 오류
        throw err; // 원래 오류 전파
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
      // makeApiRequest를 호출하여 검색 실행
      const data = await makeApiRequest('/api/recommend-genres', { query: searchQuery });
      console.log("[runSearch] Search API call successful.");
      setSearchedArtist(data.searchedArtist || null);
      setRecommendations(data.aiRecommendations || []);
      setTopTracks(data.topTracks || []);
    } catch (err: any) {
      console.error("[runSearch] Search ultimately failed:", err);
      // makeApiRequest에서 발생한 오류 메시지 사용
      setError(err.message || '추천 정보를 가져오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [makeApiRequest]); // makeApiRequest 의존성


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
      // makeApiRequest를 호출하여 플레이리스트 저장
      const data = await makeApiRequest('/api/save-playlist', {
        trackIds,
        artistName: searchedArtist.name
      });
      alert(`플레이리스트가 성공적으로 생성되었습니다! Spotify에서 확인해보세요.\nURL: ${data.playlistUrl}`);
      console.log("[handleSavePlaylist] Playlist saved successfully.");
    } catch (err: any) {
      console.error("[handleSavePlaylist] Save playlist ultimately failed:", err);
      // makeApiRequest에서 발생한 오류 메시지 사용
      setError(err.message || '플레이리스트 생성에 실패했습니다.');
    } finally {
        setLoading(false);
    }
  }, [recommendations, searchedArtist, makeApiRequest]);


  // --- JSX 렌더링 ---
  return (
    <div className="App">
       {/* ... (헤더, 메인, 푸터 JSX 구조는 이전과 거의 동일) ... */}
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