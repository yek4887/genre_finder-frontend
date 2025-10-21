import axios from 'axios';

// API 응답 타입 정의
export interface Genre {
  name: string;
  description: string;
  artists: string[];
}

export interface GenreRecommendationResponse {
  genres: Genre[];
}

// API 기본 URL 설정
const API_BASE_URL = 'http://localhost:3001';

// 장르 추천 API 요청 함수
export const fetchGenreRecommendations = async (query: string): Promise<GenreRecommendationResponse> => {
  try {
    const response = await axios.post<GenreRecommendationResponse>(
      `${API_BASE_URL}/api/recommend-genres`,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10초 타임아웃
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('장르 추천 API 요청 실패:', error);
    
    // 에러 발생 시 기본 장르 데이터 반환
    return {
      genres: [
        {
          name: "Lo-fi Hip Hop",
          description: "편안하고 차분한 비트로 휴식 시간에 듣기 좋은 힙합 장르입니다.",
          artists: ["Nujabes", "J Dilla", "Tomppabeats"]
        },
        {
          name: "Synthwave",
          description: "1980년대를 연상시키는 사이버펑크적 사운드와 신시사이저가 특징인 전자음악 장르입니다.",
          artists: ["Tame Impala", "Kavinsky", "The Midnight"]
        },
        {
          name: "Dream Pop",
          description: "몽환적이고 아름다운 멜로디가 특징인 팝 장르입니다.",
          artists: ["Beach House", "Cocteau Twins", "Mazzy Star"]
        }
      ]
    };
  }
};

// 헬스체크 API 요청 함수
export const checkServerHealth = async (): Promise<boolean> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/health`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch (error) {
    console.error('서버 헬스체크 실패:', error);
    return false;
  }
};
