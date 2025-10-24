// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios'; // AxiosError 타입 추가
import './App.css'; 

// ... (타입 정의 및 Loader 컴포넌트는 이전과 동일) ...
interface Artist { name: string; imageUrl?: string; }
interface RecommendedArtist { artistName?: string; spotifyTrackId: string; }
interface GenreRecommendation { name: string; description: string; artists?: RecommendedArtist[]; imageUrl?: string | null; }
interface Track { name: string; url: string; }
const Loader = () => ( <div className="flex justify-center items-center py-10"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-spotify-green"></div></div> );


function App() {
  const [query, setQuery] = useState('');
  const [searchedArtist, setSearchedArtist] = useState<Artist | null>(null);
  const [recommendations, setRecommendations] = useState<GenreRecommendation[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => { /* ... 토큰 확인 로직 동일 ... */ }, []);
  const handleLogin = () => { /* ... 로그인 로직 동일 ... */ };
  const handleLogout = () => { /* ... 로그아웃 로직 동일 ... */ };

  const runSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) { setError('아티스트/곡명을 입력해주세요.'); return; }
    if (!accessToken) { setError('먼저 Spotify로 로그인해주세요.'); return; }

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
      setSearchedArtist(response.data.searchedArtist || null);
      setRecommendations(response.data.aiRecommendations || []);
      setTopTracks(response.data.topTracks || []);
    } catch (err) { // 타입스크립트 에러 처리를 위해 err 타입을 명시적으로 처리
      let errorMessage = '추천 정보를 가져오는 데 실패했습니다.'; // 기본 에러 메시지
      if (axios.isAxiosError(err)) { // Axios 에러인지 확인
        const axiosError = err as AxiosError<{ error?: string }>; // 서버 응답 타입 가정
        // 서버에서 보낸 에러 메시지가 있다면 사용, 없다면 Axios 상태 텍스트 사용
        errorMessage = axiosError.response?.data?.error || axiosError.message || errorMessage;
        console.error("Axios Search Error:", axiosError.response?.status, axiosError.response?.data, axiosError.message);
      } else {
        // Axios 에러가 아닌 경우 (네트워크 오류 등)
        errorMessage = '네트워크 오류 또는 알 수 없는 오류가 발생했습니다.';
        console.error("Non-Axios Search Error:", err);
      }
      setError(errorMessage); // 사용자에게 보여줄 에러 메시지 설정
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => { /* ... 이전과 동일 ... */ };
  const handleArtistClick = (artistName?: string) => { /* ... 이전과 동일 ... */ };
  const handleSavePlaylist = async () => { /* ... 이전과 동일 ... */ };

  return (
    <div className="App">
       {/* ... (헤더, 메인, 푸터 JSX 구조는 이전과 동일) ... */}
       {/* 단, 에러 메시지 표시 부분이 setError(errorMessage) 로 업데이트 됨 */}
       <header className="App-header">
         {/* ... 로그인/로그아웃 버튼 ... */}
         <h1>Genre Finder</h1>
         <p>...</p>
         {accessToken && ( <form onSubmit={handleFormSubmit}> {/* ... 검색 폼 ... */} </form> )}
         {error && <p className="error">{error}</p>} {/* 에러 메시지 표시 */}
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