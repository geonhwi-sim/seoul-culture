# 지금 서울

서울에서 지금 열리는 전시와 공연을 모아 보는 모바일 웹앱(PWA). 행사 소개, 일정, 장소, 예매처 링크를 한곳에서 볼 수 있습니다.

## 데이터
티켓 사이트를 크롤링하지 않고 공식 공개 API만 사용합니다.

| 출처 | 내용 | 인증키 |
|---|---|---|
| [KOPIS 공연예술통합전산망](https://www.kopis.or.kr/por/cs/openapi/openApiInfo.do) | 서울 공연 + 예매처 링크 | `KOPIS_API_KEY` |
| [서울 열린데이터광장 문화행사 정보](https://data.seoul.go.kr/dataList/OA-15486/S/1/datasetView.do) | 전시·공연, 좌표, 예약 링크 | `SEOUL_API_KEY` |
| [한국문화정보원 한눈에보는문화정보](https://www.data.go.kr/data/15138937/openapi.do) | 전시 보강 (선택) | `KCISA_API_KEY` |

## 실행
```bash
npm install
cp .env.example .env   # 인증키 입력
npm run fetch          # public/events.json 생성
npm run dev
```

## 자동 갱신
`.github/workflows/update.yml`이 매일 05:00(KST)에 수집, 커밋, GitHub Pages 배포를 합니다.
저장소 Settings > Secrets에 위 인증키를, Settings > Pages의 Source를 **GitHub Actions**로 설정하세요.
