// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';
// './App.css' import 경로가 올바른지 확인합니다.
// 만약 App.css 파일이 src 폴더 밖에 있다면 경로를 수정해야 합니다.
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
    // URL 쿼리 파라미터에서 토큰 가져오기 시도
    const tokenFromUrl = new URLSearchParams(window.location.search).get('access_token');
    // 로컬 스토리지에서 토큰 가져오기 시도
    const tokenFromStorage = localStorage.getItem('spotify_access_token');

    if (tokenFromUrl) {
        // URL에 토큰이 있으면 로컬 스토리지에 저장하고 상태 업데이트
        localStorage.setItem('spotify_access_token', tokenFromUrl);
        setAccessToken(tokenFromUrl);
        // 주소창에서 토큰 정보 제거 (보안 및 깔끔함)
        window.history.pushState({}, document.title, "/");
    } else if (tokenFromStorage) {
        // 로컬 스토리지에 토큰이 있으면 상태 업데이트
        setAccessToken(tokenFromStorage);
    }
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  // Spotify 로그인 페이지로 리디렉션하는 함수
  const handleLogin = () => {
    window.location.href = 'https://genre-finder-backend.onrender.com/api/login';
  };

  // 로그아웃 함수
  const handleLogout = () => {
    setAccessToken(null); // 상태에서 토큰 제거
    localStorage.removeItem('spotify_access_token'); // 로컬 스토리지에서 토큰 제거
    window.location.reload(); // 페이지 새로고침
  };

  // 검색 로직을 별도 함수로 분리
  const runSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setError('아티스트/곡명을 입력해주세요.');
      return;
    }
    if (!accessToken) {
      setError('먼저 Spotify로 로그인해주세요.');
      return;
    }

    setLoading(true); // 로딩 시작
    setError(''); // 이전 에러 메시지 초기화
    // 이전 검색 결과 초기화
    setSearchedArtist(null);
    setRecommendations([]);
    setTopTracks([]);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 검색 시 화면 상단으로 스크롤

    try {
      // 백엔드 API 호출
      const response = await axios.post('https://genre-finder-backend.onrender.com/api/recommend-genres', {
        query: searchQuery,
        accessToken
      });
      // 응답 데이터로 상태 업데이트 (데이터 없으면 빈 배열로 초기화)
      setSearchedArtist(response.data.searchedArtist);
      setRecommendations(response.data.aiRecommendations || []);
      setTopTracks(response.data.topTracks || []);
    } catch (err: any) {
      // 에러 처리
      setError(err.response?.data?.error || '추천 정보를 가져오는 데 실패했습니다.');
    } finally {
      setLoading(false); // 로딩 종료
    }
  };

  // 검색 폼 제출 시 호출되는 함수
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // 기본 폼 제출 동작 방지
    runSearch(query); // 검색 로직 실행
  };

  // 추천 아티스트 이름 클릭 시 호출되는 함수
  const handleArtistClick = (artistName: string) => {
    setQuery(artistName); // 검색창 값을 클릭한 아티스트 이름으로 변경
    runSearch(artistName); // 해당 아티스트로 즉시 검색 실행
  };

  // 플레이리스트 저장 함수
  const handleSavePlaylist = async () => {
    // 필요한 데이터가 없으면 실행 중단
    if (!accessToken || !recommendations.length || !searchedArtist) {
      alert('먼저 아티스트를 검색해주세요.');
      return;
    }

    // 추천된 모든 곡의 Spotify 트랙 ID 추출
    const trackIds = recommendations.flatMap(genre => genre.artists.map(artist => artist.spotifyTrackId));

    try {
      // 백엔드에 플레이리스트 저장 요청
      const response = await axios.post('https://genre-finder-backend.onrender.com/api/save-playlist', {
        accessToken,
        trackIds,
        artistName: searchedArtist.name // 플레이리스트 이름에 사용될 아티스트 이름
      });
      // 성공 메시지 표시
      alert(`플레이리스트가 성공적으로 생성되었습니다! Spotify에서 확인해보세요.\nURL: ${response.data.playlistUrl}`);
    } catch (err) {
      alert('플레이리스트 생성에 실패했습니다.');
    }
  };

  // 화면 렌더링 부분
  return (
    <div className="App">
      <header className="App-header">
        {/* 로그인 상태에 따라 로그인/로그아웃 버튼 표시 */}
        {accessToken ? (
          <button onClick={handleLogout} className="logout-button">Logout</button>
        ) : (
          <button onClick={handleLogin} className="login-button">Login with Spotify</button>
        )}

        <h1>Genre Finder</h1>
        <p>AI가 당신의 취향에 맞는 새로운 음악 장르를 찾아드립니다.</p>

        {/* 로그인 상태일 때만 검색 폼 표시 */}
        {accessToken && (
          <form onSubmit={handleFormSubmit}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)} // 입력값 변경 시 query 상태 업데이트
              placeholder="좋아하는 아티스트 혹은 곡명을 입력하세요"
              disabled={loading} // 로딩 중일 때는 입력 비활성화
            />
            <button type="submit" disabled={loading}>
              {loading ? '찾는 중...' : '검색'}
            </button>
          </form>
        )}

        {/* 에러 메시지가 있을 경우 표시 */}
        {error && <p className="error">{error}</p>}
      </header>

      <main>
        {/* 검색된 아티스트 정보 표시 */}
        {searchedArtist && (
          <div className="search-result-container">
            <div className="searched-artist">
              {/* 아티스트 이미지가 있으면 표시, 없으면 기본 이미지(선택사항) */}
              <img src={searchedArtist.imageUrl || 'https://via.placeholder.com/150'} alt={searchedArtist.name} />
              <h2>{searchedArtist.name}</h2>
            </div>

            {/* 대표곡 목록 표시 (목록이 비어있지 않을 때만) */}
            {topTracks.length > 0 && (
              <div className="top-tracks">
                <h3>Top Tracks on Spotify</h3>
                <ol>
                  {topTracks.map((track) => (
                    <li key={track.url}>
                      {/* Spotify 곡 링크 연결 */}
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

        {/* 추천 장르 목록이 있을 때만 저장 버튼 표시 */}
        {recommendations.length > 0 && (
          <div className="playlist-save-container">
            <button onClick={handleSavePlaylist} className="save-playlist-button">
              {/* 수정된 SVG 아이콘 */}
              <svg viewBox="0 0 168 168" className="spotify-icon">
                <path fill="currentColor" d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.25 37.494 83.742 83.743 83.742 46.249 0 83.744-37.492 83.744-83.742C167.74 37.77 130.245.277 83.996.277zM122.16 120.844c-1.402 2.336-4.515 3.086-6.852 1.684-19.102-11.52-43.045-14.094-71.328-7.727-2.78.61-5.468-1.14-6.078-3.92-.61-2.78 1.14-5.468 3.92-6.078 30.735-6.852 57.03-3.996 78.473 8.945 2.336 1.402 3.086 4.515 1.684 6.852zm8.586-24.59c-1.742 2.898-5.586 3.84-8.484 2.098-21.492-12.985-53.75-16.7-79.094-9.195-3.414.992-6.945-1.125-7.938-4.539-.992-3.414 1.125-6.945 4.539-7.938 28.328-8.234 63.68-4.14 87.82 10.64 2.898 1.742 3.84 5.586 2.098 8.484zm1.14-25.532c-25.53-15.01-67.203-16.33-93.594-9.012-4.023 1.125-8.226-1.5-9.35-5.523-1.125-4.024 1.5-8.227 5.523-9.352 29.93-8.086 75.63-6.524 104.58 10.43 3.555 2.086 4.742 6.773 2.656 10.328-2.086 3.554-6.773 4.742-10.328 2.656z"></path>
              </svg>
              추천곡을 내 플레이리스트로 저장하기
            </button>
          </div>
        )}

        {/* 추천 장르 카드 목록 렌더링 */}
        <div className="recommendations">
          {recommendations.map((genre) => (
            <div key={genre.name} className="genre-card">
              {/* 좌측: 장르명, 이미지 */}
              <div className="genre-column genre-identity">
                <h3>{genre.name}</h3>
                {genre.imageUrl && <img src={genre.imageUrl} alt={genre.name} className="genre-image" />}
              </div>
              {/* 가운데: 장르 설명 */}
              <div className="genre-column genre-description">
                <p>{genre.description}</p>
              </div>
              {/* 우측: 대표 아티스트 목록 (클릭 가능) */}
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
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="App-footer">
        <p>© {new Date().getFullYear()} Genre Finder. All Rights Reserved.</p>
        <p>Powered by Spotify. All music data and images are properties of Spotify AB.</p>
      </footer>
    </div>
  );
}

export default App;

