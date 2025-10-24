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
  const [isRefreshingToken, setIsRefreshingToken] = useState(false); // 토큰 갱신 중 상태 추가

  // --- 토큰 관리 ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('access_token');
    const refreshFromUrl = params.get('refresh_token');
    const expiresInFromUrl = params.get('expires_in');

    const tokenFromStorage = localStorage.getItem('spotify_access_token');
    const refreshFromStorage = localStorage.getItem('spotify_refresh_token');
    const expiryFromStorage = localStorage.getItem('spotify_token_expiry');

    if (tokenFromUrl && refreshFromUrl && expiresInFromUrl) {
      // 토큰 만료 시간 계산 (현재 시간 + 만료 시간(초) * 1000) - 안전 마진(60초)
      const expiryTimestamp = Date.now() + (parseInt(expiresInFromUrl, 10) - 60) * 1000;
      localStorage.setItem('spotify_access_token', tokenFromUrl);
      localStorage.setItem('spotify_refresh_token', refreshFromUrl);
      localStorage.setItem('spotify_token_expiry', expiryTimestamp.toString());
      setAccessToken(tokenFromUrl);
      setRefreshToken(refreshFromUrl);
      setTokenExpiryTime(expiryTimestamp);
      console.log("Token received from URL and saved. Expires at:", new Date(expiryTimestamp));
      window.history.pushState({}, document.title, window.location.pathname);
    } else if (tokenFromStorage && refreshFromStorage && expiryFromStorage) {
      const expiryTimestamp = parseInt(expiryFromStorage, 10);
      // 저장된 만료 시간이 유효한 숫자인지 확인
      if (!isNaN(expiryTimestamp)) {
        setAccessToken(tokenFromStorage);
        setRefreshToken(refreshFromStorage);
        setTokenExpiryTime(expiryTimestamp);
        console.log("Token loaded from storage. Expires at:", new Date(expiryTimestamp));
      } else {
        console.error("Invalid expiry time found in storage.");
        // 잘못된 만료 시간이면 로그아웃 처리
        handleLogout();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // handleLogout을 의존성 배열에서 제거 (무한 루프 방지)

    // --- 로그아웃 함수 ---
    const handleLogout = useCallback(() => {
        console.log("Logging out...");
        setAccessToken(null); setRefreshToken(null); setTokenExpiryTime(null);
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expiry');
        window.location.href = '/'; // 홈으로 리디렉션하며 상태 초기화
    }, []); // 의존성 없음

  // --- 토큰 갱신 함수 ---
  const refreshAccessToken = useCallback(async () => {
    // 이미 갱신 중이면 추가 시도 방지
    if (isRefreshingToken) {
        console.log("Token refresh already in progress, waiting...");
        // 잠시 기다렸다가 현재 accessToken 반환 시도 (옵션)
        await new Promise(resolve => setTimeout(resolve, 1000));
        return accessToken; // 현재 토큰 반환 (갱신 성공 시 업데이트될 것임)
    }
    if (!refreshToken) {
      console.error("No refresh token available for refresh.");
      handleLogout();
      return null;
    }

    console.log("Attempting to refresh access token...");
    setIsRefreshingToken(true); // 갱신 시작 상태
    try {
      const response = await axios.post(`${API_BASE_URL}/api/refresh_token`, { refreshToken });
      const { accessToken: newAccessToken, expiresIn } = response.data;
      if (newAccessToken && expiresIn) {
        // 만료 시간 새로 계산 (안전 마진 포함)
        const newExpiryTimestamp = Date.now() + (expiresIn - 60) * 1000;
        localStorage.setItem('spotify_access_token', newAccessToken);
        localStorage.setItem('spotify_token_expiry', newExpiryTimestamp.toString());
        setAccessToken(newAccessToken);
        setTokenExpiryTime(newExpiryTimestamp);
        console.log("Access token refreshed successfully. New expiry:", new Date(newExpiryTimestamp));
        return newAccessToken;
      } else {
        throw new Error("Invalid response structure from refresh token endpoint");
      }
    } catch (err) {
      console.error("Failed to refresh access token:", err);
      handleLogout(); // 갱신 최종 실패 시 로그아웃
      return null;
    } finally {
        setIsRefreshingToken(false); // 갱신 종료 상태
    }
  }, [refreshToken, handleLogout, isRefreshingToken, accessToken]); // 의존성 추가

  // --- API 요청 래퍼 함수 (토큰 갱신 로직 강화) ---
  const makeApiRequest = useCallback(async (endpoint: string, data: any) => {
    let currentAccessToken = accessToken; // 현재 상태의 토큰으로 시작

    console.log("Making API request. Current Token Expiry:", tokenExpiryTime ? new Date(tokenExpiryTime) : 'N/A');

    // 토큰 만료 여부 확인 (현재 시간과 비교)
    if (tokenExpiryTime && Date.now() >= tokenExpiryTime) {
      console.log("Token potentially expired based on time, attempting refresh before request...");
      currentAccessToken = await refreshAccessToken(); // 먼저 갱신 시도
      if (!currentAccessToken) {
          throw new Error("Token refresh failed. Please log in again.");
      }
      // 갱신된 토큰으로 data 업데이트
      data.accessToken = currentAccessToken;
    } else if (!currentAccessToken) {
         throw new Error("No access token available. Please log in.");
    }

    // data 객체에 accessToken 키가 없다면 현재 토큰 추가
    if (!data.accessToken) {
        data.accessToken = currentAccessToken;
    }

    try {
      // 실제 API 요청
      console.log(`Sending API request to ${endpoint} with token prefix: ${currentAccessToken?.substring(0,5)}`);
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, data);
      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        // 401 오류 발생 시 (만료 시간 체크와 별개로 실제 만료)
        console.log("Received 401 Unauthorized during API request, attempting force refresh...");
        currentAccessToken = await refreshAccessToken(); // 강제 갱신
        if (currentAccessToken) {
          console.log("Retrying API request with newly refreshed token...");
          data.accessToken = currentAccessToken; // 갱신된 토큰으로 data 업데이트
          try {
             // 재시도
             const retryResponse = await axios.post(`${API_BASE_URL}${endpoint}`, data);
             return retryResponse.data;
          } catch(retryErr) {
             console.error("API request failed on retry after refresh:", retryErr);
             // 재시도 실패 시 최종 에러는 handleLogout 등을 유발할 수 있도록 전파
             handleLogout(); // 재시도 실패 시 그냥 로그아웃
             throw new Error("Failed to complete request even after token refresh.");
          }
        } else {
           // 강제 갱신 실패 시
           throw new Error("Token refresh failed after 401. Please log in again.");
        }
      } else {
        // 401 외 다른 오류
        console.error("API request failed:", err);
        throw err; // 원래 오류 전파
      }
    }
  }, [accessToken, tokenExpiryTime, refreshAccessToken, handleLogout]); // 의존성 배열 업데이트


  // --- 검색 실행 함수 ---
  const runSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setError('아티스트/곡명을 입력해주세요.'); return; }
    setLoading(true); setError('');
    setSearchedArtist(null); setRecommendations([]); setTopTracks([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      console.log("Running search for:", searchQuery);
      const data = await makeApiRequest('/api/recommend-genres', { query: searchQuery });
      setSearchedArtist(data.searchedArtist || null);
      setRecommendations(data.aiRecommendations || []);
      setTopTracks(data.topTracks || []);
      console.log("Search successful.");
    } catch (err: any) {
      setError(err.message || '추천 정보를 가져오는 데 실패했습니다.');
      console.error("Search ultimately failed:", err);
    } finally {
      setLoading(false);
    }
  }, [makeApiRequest]); // makeApiRequest 의존성


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
      setQuery(artistName);
      runSearch(artistName);
    }
  };

  // --- 플레이리스트 저장 핸들러 ---
  const handleSavePlaylist = useCallback(async () => {
    if (!recommendations.length || !searchedArtist) { alert('먼저 아티스트를 검색해주세요.'); return; }

    const trackIds = recommendations.flatMap(g => g.artists || []).map(a => a.spotifyTrackId).filter(id => !!id);
    if (trackIds.length === 0) { alert('저장할 추천곡 정보가 없습니다.'); return; }

    setLoading(true); setError('');
    console.log("Saving playlist for:", searchedArtist.name);

    try {
      const data = await makeApiRequest('/api/save-playlist', {
        trackIds,
        artistName: searchedArtist.name
      });
      alert(`플레이리스트가 성공적으로 생성되었습니다! Spotify에서 확인해보세요.\nURL: ${data.playlistUrl}`);
      console.log("Playlist saved successfully.");
    } catch (err: any) {
      setError(err.message || '플레이리스트 생성에 실패했습니다.');
      console.error("Save playlist ultimately failed:", err);
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