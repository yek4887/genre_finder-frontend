// frontend/src/App.tsx
import { useState } from 'react';
import SearchBar from './components/SearchBar';
import GenreCard from './components/GenreCard';
import Loader from './components/Loader';
import { ArtistCard } from './components/ArtistCard'; // 새로 만든 컴포넌트 import
import axios from 'axios'; // API 호출을 위해 axios 사용

// 새로운 데이터 타입들을 정의
export interface Genre {
  name: string;
  description: string;
  artists: string[];
}

interface Track {
  title: string;
  album: string;
}

interface SearchedArtist {
  name: string;
  imageUrl: string;
  topTracks: Track[];
}

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 상태들을 새로운 데이터 구조에 맞게 변경
  const [searchedArtist, setSearchedArtist] = useState<SearchedArtist | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<Genre[]>([]);

  const handleSearch = async (query: string) => {
    if (!query) return;

    setIsLoading(true);
    setError(null);
    setSearchedArtist(null);
    setAiRecommendations([]);

    try {
      // 이제 실제 백엔드 API를 호출!
      const response = await axios.post('https://genre-finder-backend.onrender.com', { query });
      setSearchedArtist(response.data.searchedArtist);
      setAiRecommendations(response.data.aiRecommendations);
    } catch (err) {
      setError('추천 정보를 가져오는 데 실패했습니다. 아티스트 이름을 확인해주세요.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-8">
      <div className="container mx-auto max-w-4xl">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2">Genre Finder</h1>
          <p className="text-gray-400 text-lg">AI가 당신의 취향에 맞는 새로운 음악 장르를 찾아드립니다</p>
        </header>

        <main>
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />

          <div className="mt-12 space-y-12">
            {isLoading && <Loader />}
            {error && <p className="text-red-500 text-center">{error}</p>}

            {/* 검색한 아티스트 정보 표시 */}
            {!isLoading && searchedArtist && (
              <ArtistCard 
                name={searchedArtist.name}
                imageUrl={searchedArtist.imageUrl}
                topTracks={searchedArtist.topTracks}
              />
            )}

            {/* AI 추천 장르 표시 */}
            {!isLoading && aiRecommendations.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-center mb-6">이런 장르는 어떠세요?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {aiRecommendations.map((genre, index) => (
                    <GenreCard key={index} genre={genre} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;