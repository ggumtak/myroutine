# 노래일기 (SongDiary)

Capacitor(Android) 앱 `com.songdiary.app`의 웹 소스입니다. 빌드 결과물 APK
(`노래일기-1.0.0.apk`)의 `assets/public`을 그대로 꺼내 온 것이 첫 커밋이에요.

- `www/` — 앱 화면 전체 (빌드 도구 없이 순수 HTML/CSS/JS)
  - `app.js` 화면·기록 로직, `native.js` 저장소(IndexedDB)·백업·안드로이드 연결
  - `fonts/`, `fonts.css` Gaegu · IBM Plex Sans KR (앱 안에 포함, 오프라인 동작)
