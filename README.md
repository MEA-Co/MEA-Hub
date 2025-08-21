# Next.js + TypeScript Starter Setup

## 📦 포함된 설정

1.  **Node 버전 고정**
    - `.nvmrc` 파일을 사용하여 LTS 버전으로 고정
2.  **ESLint + Prettier**
    - 코드 린팅 및 자동 포맷팅\

    - 스크립트:

      ```bash
      npm run lint
      npm run format
      ```

3.  **환경변수 관리**
    - `.env` → 개인/비밀 값 (커밋 금지)
4.  **Git 설정**
    - `.gitignore` → node_modules, .next, dist, .env\* 등 제외
    - `.gitattributes` → 개행 통일 (LF)
    - `.editorconfig` → 들여쓰기/줄바꿈 통일
5.  **타입체크 스크립트**
    - 타입 오류 검사용 스크립트

      ```bash
      npm run typecheck
      ```

## 🚀 사용법

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev

# 코드 포맷팅
npm run format

# 린트 검사
npm run lint

# 타입체크
npm run typecheck
```

## 🛠️ 환경 변수

- `.env` 파일에 비밀 값을 작성합니다. (Git에 커밋하지 않음)
