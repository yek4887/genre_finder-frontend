import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading = false }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="아티스트 이름이나 분위기를 입력해보세요... (예: Tame Impala, 비 오는 날 듣기 좋은)"
            className="w-full px-6 py-4 text-lg bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-lg rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          {isLoading ? '검색 중...' : '새로운 장르 찾기'}
        </button>
      </form>
    </div>
  );
};

export default SearchBar;
