# Authentication Test Guide

## Problem
Dashboard açıldığında boş sayfa görünüyor

## Test Adımları

### 1. Tarayıcıda Test
1. http://localhost:5173/ adresini aç
2. F12 ile DevTools aç
3. Console tab'ine git
4. Şu komutu çalıştır:
```javascript
localStorage.setItem('isDemoAuthed', 'true');
localStorage.setItem('userRole', 'manager');
```
5. http://localhost:5173/dashboard adresine git
6. Sayfa yüklenirse başarılı, boş kalırsa console'da hata var

### 2. Login Page Test
1. http://localhost:5173/login adresine git
2. "Use Demo Account" butonuna tıkla
3. Console'da hataları kontrol et
4. Network tab'de redirect olup olmadığını kontrol et

### 3. Console Hataları
Eğer dashboard boş kalıyorsa, console'da şu hatalardan biri olabilir:
- `Cannot read properties of undefined`
- `Uncaught Error: A component suspended`
- `ChunkLoadError`
- `Failed to fetch dynamically imported module`

### 4. Çözümler

#### Sorun: Lazy Loading Hatası
```
Solution: src/App.tsx'da Suspense fallback'i kontrol et
```

#### Sorun: Authentication State Kaybolması
```
Solution: AuthContext'in localStorage'ı doğru okuduğunu kontrol et
```

#### Sorun: Route Eşleşmemesi
```
Solution: ProtectedRoute'un isAuthenticated'ı doğru okuduğunu kontrol et
```

## Quick Fix Script

Eğer problem devam ederse, tarayıcı console'una şunu yapıştır:

```javascript
// Clear all storage
localStorage.clear();
sessionStorage.clear();

// Set authentication
localStorage.setItem('isDemoAuthed', 'true');
localStorage.setItem('userRole', 'manager');

// Reload
window.location.href = '/dashboard';
```

## Build Test

Eğer dev mode'da çalışıyorsa ama production build'de problem varsa:

```bash
npm run build
npm run preview
```

Sonra http://localhost:4173/dashboard adresini test et.
