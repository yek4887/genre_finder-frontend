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
    console.log("handleLogout called."); // 로그 추가
    setAccessToken(null); setRefreshToken(null); setTokenExpiryTime(null);
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
    // window.location.reload(); // 새로고침 대신 상태 초기화로 처리 시도
    window.location.href = '/'; // 확실한 초기화를 위해 홈으로 리디렉션
  }, []);

  // --- 토큰 관리 ---
  useEffect(() => {
    console.log("useEffect for token check running..."); // 로그 추가
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('access_token');
    const refreshFromUrl = params.get('refresh_token');
    const expiresInFromUrl = params.get('expires_in');

    const tokenFromStorage = localStorage.getItem('spotify_access_token');
    const refreshFromStorage = localStorage.getItem('spotify_refresh_token');
    const expiryFromStorage = localStorage.getItem('spotify_token_expiry');

    if (tokenFromUrl && refreshFromUrl && expiresInFromUrl) {
      // 안전 마진(60초) 포함하여 만료 시간 계산
      const expiryTimestamp = Date.now() + (parseInt(expiresInFromUrl, 10) - 60) * 1000;
      console.log(`Token from URL. Expires In: ${expiresInFromUrl}s, Calculated Expiry: ${new Date(expiryTimestamp)}`); // 로그 추가
      localStorage.setItem('spotify_access_token', tokenFromUrl);
      localStorage.setItem('spotify_refresh_token', refreshFromUrl);
      localStorage.setItem('spotify_token_expiry', expiryTimestamp.toString());
      setAccessToken(tokenFromUrl);
      setRefreshToken(refreshFromUrl);
      setTokenExpiryTime(expiryTimestamp);
      window.history.pushState({}, document.title, window.location.pathname);
    } else if (tokenFromStorage && refreshFromStorage && expiryFromStorage) {
      const expiryTimestamp = parseInt(expiryFromStorage, 10);
      if (!isNaN(expiryTimestamp)) {
        // 만료 시간 지났는지 여기서도 한번 체크
        if (Date.now() < expiryTimestamp) {
          setAccessToken(tokenFromStorage);
          setRefreshToken(refreshFromStorage);
          setTokenExpiryTime(expiryTimestamp);
          console.log("Token loaded from storage. Expires at:", new Date(expiryTimestamp)); // 로그 추가
        } else {
            console.log("Token from storage is expired. Attempting refresh on next API call or manual refresh.");
            // 만료된 토큰은 상태에 설정하지 않거나, refresh 시도 (여기서는 설정하고 다음 요청 시 갱신)
             setAccessToken(tokenFromStorage); // 일단 설정은 하되, 만료된 상태
             setRefreshToken(refreshFromStorage);
             setTokenExpiryTime(expiryTimestamp);
             // 또는 즉시 갱신 시도 (선택 사항)
             // refreshAccessToken();
        }
      } else {
        console.error("Invalid expiry time found in storage. Clearing tokens.");
        handleLogout();
      }
    } else {
         console.log("No token found in URL or storage."); // 로그 추가
    }
  }, [handleLogout]); // handleLogout 의존성 유지

  // --- 토큰 갱신 함수 ---
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (isRefreshingToken) {
        console.warn("Refresh already in progress.");
        // 간단히 null 반환하여 동시 요청 방지
        return null; // 또는 Promise를 반환하여 대기하도록 구현 가능
    }
    if (!refreshToken) {
      console.error("No refresh token available. Logging out.");
      handleLogout();
      return null;
    }

    console.log("Attempting to refresh access token using refresh token:", refreshToken.substring(0,5)+"...");
    setIsRefreshingToken(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/refresh_token`, { refreshToken });
      const { accessToken: newAccessToken, expiresIn } = response.data;
      if (newAccessToken && expiresIn) {
        const newExpiryTimestamp = Date.now() + (expiresIn - 60) * 1000; // 안전 마진 포함
        localStorage.setItem('spotify_access_token', newAccessToken);
        localStorage.setItem('spotify_token_expiry', newExpiryTimestamp.toString());
        // Refresh Token은 그대로 유지되므로 저장 안 함
        setAccessToken(newAccessToken); // 상태 업데이트
        setTokenExpiryTime(newExpiryTimestamp); // 상태 업데이트
        console.log("Access token refreshed successfully. New expiry:", new Date(newExpiryTimestamp));
        return newAccessToken; // 새 토큰 반환
      } else {
        console.error("Invalid response from refresh token endpoint:", response.data);
        throw new Error("Invalid response structure from refresh token endpoint");
      }
    } catch (err: any) {
      console.error("Failed to refresh access token:", err.response?.data || err.message || err);
      // 갱신 실패 시 로그아웃
      handleLogout();
      return null; // 실패 시 null 반환
    } finally {
        setIsRefreshingToken(false);
    }
  }, [refreshToken, handleLogout, isRefreshingToken]); // accessToken 제거됨

  // --- API 요청 래퍼 함수 ---
  const makeApiRequest = useCallback(async (endpoint: string, data: any) => {
    let currentToken = accessToken; // 요청 시점의 토큰 사용

    console.log(`[makeApiRequest] Requesting ${endpoint}. Token expiry: ${tokenExpiryTime ? new Date(tokenExpiryTime) : 'N/A'}`);

    // 만료 시간 확인 (Date.now()와 비교)
    if (tokenExpiryTime && Date.now() >= tokenExpiryTime) {
      console.warn("[makeApiRequest] Token expired based on time. Refreshing...");
      currentToken = await refreshAccessToken(); // 갱신 시도
      if (!currentToken) {
          console.error("[makeApiRequest] Token refresh failed. Aborting request.");
          throw new Error("Failed to refresh token. Please log in again."); // 오류 발생시켜 중단
      }
      console.log("[makeApiRequest] Token refreshed before request.");
    } else if (!currentToken) {
        console.error("[makeApiRequest] No access token available.");
         throw new Error("No access token available. Please log in.");
    }

    // 요청 데이터에 현재 유효한 토큰 포함
    const requestData = { ...data, accessToken: currentToken };

    try {
      // 실제 API 요청
      console.log(`[makeApiRequest] Sending POST to ${endpoint} with token prefix: ${currentToken?.substring(0,5)}`);
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, requestData);
      console.log(`[makeApiRequest] Request to ${endpoint} successful.`);
      return response.data;
    } catch (err) {
      console.error(`[makeApiRequest] Initial request to ${endpoint} failed:`, err);
      // 401 오류(토큰 만료) 감지 시 재시도
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        console.warn("[makeApiRequest] Received 401 Unauthorized. Attempting force refresh...");
        currentToken = await refreshAccessToken(); // 강제 갱신
        if (currentToken) {
          console.log("[makeApiRequest] Force refresh successful. Retrying request...");
          requestData.accessToken = currentToken; // 갱신된 토큰으로 업데이트
          try {
             // 재시도 (단 한번)
             const retryResponse = await axios.post(`${API_BASE_URL}${endpoint}`, requestData);
             console.log(`[makeApiRequest] Retry request to ${endpoint} successful.`);
             return retryResponse.data;
          } catch(retryErr) {
             console.error("[makeApiRequest] Retry request failed after refresh:", retryErr);
              // 재시도 실패 시 최종 오류 전파 (호출한 쪽에서 처리)
             throw retryErr;
          }
        } else {
           // 강제 갱신 실패 시
           console.error("[makeApiRequest] Force refresh failed.");
           throw new Error("Token refresh failed after 401. Please log in again.");
        }
      } else {
        // 401 외 다른 오류
        throw err; // 원래 오류 전파
      }
    }
  }, [accessToken, tokenExpiryTime, refreshAccessToken, handleLogout]); // 의존성 배열 점검


  // --- 검색 실행 함수 ---
  const runSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setError('아티스트/곡명을 입력해주세요.'); return; }
    console.log("[runSearch] Starting search for:", searchQuery);
    setLoading(true); setError('');
    setSearchedArtist(null); setRecommendations([]); setTopTracks([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const data = await makeApiRequest('/api/recommend-genres', { query: searchQuery });
      console.log("[runSearch] Search API call successful. Data:", data);
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
         {/* ... 로그인/로그아웃 버튼 ... */}
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
