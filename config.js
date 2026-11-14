// Cấu hình Review Hub. Sửa 2 dòng đầu sau khi làm theo HUONG-DAN.md.
// Để trống API_URL = chạy chế độ DEMO (dữ liệu mẫu, lưu trên trình duyệt).
window.RH_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxamQDdmRJj8TTyngkew1vCqp6rKEz4l0ZO6RwnrPHyUk46p68ux0cx4gv9TY19GbRvPw/exec',          // URL Web App của Apps Script, dạng https://script.google.com/macros/s/XXXX/exec
  DRIVE_API_KEY: 'AIzaSyASJCLo-FKUQ_YYHSK4GTohP8-prR44BRc',    // API key Google Cloud (đã bật Google Drive API) để phát video từ Drive
  ADMIN_EMAIL: 'sukienkynam.1@gmail.com',   // email tài khoản quản lý trong Firebase Authentication
  FIREBASE: {                                // cấu hình Firebase (nhận xét realtime)
    apiKey: 'AIzaSyDXgjoXA_KacJM1344oBWmxJ96iQMfhC04',
    authDomain: 'arboreal-moment-514703-t9.firebaseapp.com',
    projectId: 'arboreal-moment-514703-t9',
    storageBucket: 'arboreal-moment-514703-t9.firebasestorage.app',
    messagingSenderId: '938654504321',
    appId: '1:938654504321:web:c488cdcf9d00574a91c480'
  },
  FPS: 30,              // số khung hình/giây dùng cho nút ±1 khung
  BRAND: 'Review Hub'
};
