# 노래일기 (SongDiary)

Capacitor(Android) 앱 `com.songdiary.app`의 웹 소스와 APK 재빌드 도구입니다.
첫 커밋은 `노래일기-1.0.0.apk`의 `assets/public`을 그대로 꺼내 온 것이에요.

## 구성

- `www/` — 앱 화면 전체 (빌드 과정 없는 순수 HTML/CSS/JS)
  - `app.js` 화면·기록 로직
  - `songsearch.js` 노래 찾기 (초성·부분 입력 매칭, Apple Music 곡 검색)
  - `native.js` 저장소(IndexedDB)·백업·네트워크·안드로이드 연결
  - `fonts/`, `fonts.css` Gaegu · IBM Plex Sans KR (앱 안에 포함, 오프라인 동작)
- `tools/build_apk.py` — 안드로이드 SDK 없이 APK를 다시 만드는 스크립트

## 노래 찾기

노래 제목 칸에 몇 글자만 치면 노래방 리모컨처럼 찾아 줍니다.

- **내가 부른 노래**: 폰 안의 기록에서 바로 찾음. 초성(`ㅂㅇㄱ` → 밤양갱),
  띄어쓰기 무시(`사건의지평선`), 입력 중인 글자(`밤야` → 밤양갱), 가수 이름 모두 됨.
- **실제 노래**: [iTunes Search API](https://performance-partners.apple.com/search-api)
  (한국 스토어)에서 곡을 찾아 가수·앨범 사진·30초 미리듣기를 붙임. 키가 필요 없고,
  앱 안에서는 Capacitor 네이티브 HTTP로 요청해서 CORS 문제가 없음.
  보내는 건 검색어뿐이고 일기 내용은 보내지 않음. 설정에서 끌 수 있음.

노래방 곡 목록 전체(수만 곡)를 앱에 넣는 방법도 있지만, 자유롭게 쓸 수 있는 데이터가 없고
금방 낡기 때문에 온라인 검색 + 내가 부른 노래 목록(오프라인) 조합을 택했어요.
추가되는 용량은 코드 몇 KB뿐입니다.

## APK 다시 만들기

```bash
# 처음 한 번: 서명 키 만들기 (이 파일과 비밀번호를 잃어버리면 다음 업데이트 때 앱을 지웠다 깔아야 함)
keytool -genkeypair -alias songdiary -keyalg RSA -keysize 2048 -validity 36500 \
  -dname "CN=SongDiary, O=Personal, C=KR" -storetype PKCS12 -keystore songdiary-release.p12

# 기존 APK의 안드로이드 부분 + www/ → 새 APK (정렬 + v2 서명)
SONGDIARY_STOREPASS=... python3 songdiary/tools/build_apk.py \
  --base 노래일기-1.0.0.apk --www songdiary/www --keystore songdiary-release.p12 \
  --version-name 1.1.0 --version-code 2 --out 노래일기-1.1.0.apk
```

- 필요한 것: Python 3.8+, `cryptography` 패키지
- `--version-name`은 기존 값과 글자 수가 같아야 함 (예: `1.0.0` → `1.1.0`)
- 키 파일(`.p12`)은 저장소에 올리지 말 것

## 브라우저에서 확인

`www/`를 아무 정적 서버로 열면 됩니다 (예: `npx serve songdiary/www`).
녹음 파일 공유 받기, 알림, 문서 폴더 저장 같은 안드로이드 기능만 빠지고 나머지는 그대로 동작해요.
