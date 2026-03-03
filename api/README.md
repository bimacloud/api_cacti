# Cacti Read-Only REST API Backend

API ini digunakan untuk membaca data _device_, _pop_, dan _traffic_ dari Cacti 1.2.24 secara aman.

## 1. Persyaratan Sistem
- NodeJS v16+ (Disarankan LTS)
- Cacti 1.2.24 (Berjalan pada server yang sama atau memiliki RRD sharing)
- MySQL / MariaDB

## 2. Cara Instalasi (Production Ubuntu/Debian)

### A. Setup User Database (Wajib)
Jalankan script ini di konsol MySQL Anda sebagai `root`:
```sql
CREATE USER 'cacti_api_ro'@'127.0.0.1' IDENTIFIED BY 'PasswordReadOnlyKuat!';
GRANT SELECT ON cacti.* TO 'cacti_api_ro'@'127.0.0.1';
FLUSH PRIVILEGES;
```
_(Pastikan menyesuaikan `DB_PASS` pada `.env` dengan password di atas)_

### B. Setup Aplikasi
```bash
# Pindah ke direktori project
cd /opt/lampp/htdocs/cacti/api

# Install dependency
npm install

# Edit konfigurasi environment (.env)
nano .env # Sesuaikan DB_NAME, DB_USER, DB_PASS, API_TOKEN, dan ALLOWED_IPS
```

### C. Menjalankan di Background (PM2)
Bila PM2 belum tersedia:
```bash
sudo npm install -g pm2
pm2 start server.js --name "cacti-api"
pm2 save
pm2 startup
```

### D. Menjalankan menggunakan Docker di Server Production (/home/noc)
Cara paling mudah untuk men-deploy API ini adalah dengan menggunakan Docker Compose. Aplikasi ini sudah dilengkapi dengan `Dockerfile` dan `docker-compose.yml` khusus _production_.

1. Copy/Clone folder API ini ke server production Anda (misalnya ke `/home/noc/cacti-api`).
2. Masuk ke direktori tersebut: `cd /home/noc/cacti-api`
3. Edit file **`.env`** Anda. Pastikan **`USE_REMOTE_RRD=false`** karena server API dan file RRD sudah berada dalam 1 mesin yang sama. Selain itu, pastikan \`RRD_PATH\` bernilai \`/var/www/html/cacti/rra\`.
4. Jalankan perintah docker compose:
```bash
# Menjalankan di background
docker compose up -d

# Menjalankan rebuild jika ada update
docker compose up -d --build

# Melihat logs
docker compose logs -f
```

## 3. Cara Development di Laptop (Remote Data)
Karena Cacti Anda berada di *server production* (\`monitor.puskomedia.net.id\`), Anda dapat menjalankan API secara lokal di PC/Mac namun menarik data *Database* dan file RRD langsung dari server *production* tersebut.

### 3.1 Setup SSH Tunnel untuk Database MySQL
Server *production* umumnya me-blokir port \`3306\` dari IP publik. Agar Node.js di lokal bisa mengambil data Database, jalankan perintah ini di Terminal lokal Anda dan biarkan terbuka:

```bash
# Ganti 'root' dengan user SSH server production Anda
ssh -L 3306:127.0.0.1:3306 root@monitor.puskomedia.net.id
```
*(Ini akan mem-forward port \`3306\` milik server Cacti ke port \`3306\` di laptop lokal Anda).*

### 3.2 Update Konfigurasi \`.env\`
1. Clone / Copy direktori API ini ke PC/Laptop.
2. Install dependency: \`npm install\`
3. Buka file \`.env\` dan sesuaikan bagian ini:

```env
# Koneksi DB ditembakkan ke localhost (karena sudah SSH Tunnel)
DB_HOST=127.0.0.1
DB_USER=cacti_user
DB_PASS=cactipassword
DB_NAME=cacti

# Aktifkan Remote RRD Fetching via SSH
USE_REMOTE_RRD=true
SSH_HOST=monitor.puskomedia.net.id
SSH_USER=root
# SSH_PASS=password_ssh (Opsional, lebih aman pakai KEY)
SSH_KEY_PATH=/home/user_laptop_anda/.ssh/id_rsa
```

### 3.3 Menjalankan Server Lokal
```bash
npm run dev
```

> [!WARNING]
> Saat men-deploy kembali API ini ke server production \`monitor.puskomedia.net.id\`, pastikan Anda **mematikan** \`USE_REMOTE_RRD=false\` pada \`.env\` agar API kembali menggunakan \`rrdtool\` lokal dan tidak menambah *overhead* koneksi SSH.

## 4. Cara Testing via cURL
Pastikan IP terminal Anda yang sedang digunakan untuk mengeksekusi cURL ini masuk ke dalam daftar `ALLOWED_IPS` yang ada di `.env` (atau hapus nilainya untuk Allow-All).

### Mendapatkan Daftar Semua Device:
```bash
curl -i -X GET "http://127.0.0.1:3001/api/devices" \
-H "Authorization: Bearer T0k3n_R4hasia_N0c_ReP0rt1ng_2026"
```

### Mendapatkan Info Device 20:
```bash
curl -i -X GET "http://127.0.0.1:3001/api/device/20" \
-H "Authorization: Bearer T0k3n_R4hasia_N0c_ReP0rt1ng_2026"
```

### Memeriksa Status POP Devices:
```bash
curl -i -X GET "http://127.0.0.1:3001/api/pop-status" \
-H "Authorization: Bearer T0k3n_R4hasia_N0c_ReP0rt1ng_2026"
```

### Mendapatkan Data Traffic & Statistik (Local Graph ID 125):
Untuk grafik traffic, API mendukung filter tanggal (berdasarkan Unix Timestamp atau string seperti RRDTool, contoh: `-1h`, `now`, atau format tanggal standard `2026-02-01`).

```bash
curl -i -X GET "http://127.0.0.1:3001/api/traffic/125?start=2026-02-01&end=2026-03-01" \
-H "Authorization: Bearer T0k3n_R4hasia_N0c_ReP0rt1ng_2026"
```

**Contoh Response Data (Traffic JSON):**
```json
{
  "cached": false,
  "graph_info": {
    "graph_id": 125,
    "title": "IDC CNT 2216 - Traffic - JKT-IX",
    "template_name": "Interface - Traffic (bits/sec)"
  },
  "summary": {
    "total_in_raw": 5639343563537510,
    "total_out_raw": 268830385620237.9,
    "total_in_formatted": "5.64 Pb",
    "total_out_formatted": "268.83 Tb",
    "current_in_formatted": "1.86 Gb/s",
    "current_out_formatted": "233.09 Mb/s",
    "average_in_formatted": "2.33 Gb/s",
    "average_out_formatted": "111.12 Mb/s",
    "max_in_formatted": "5.36 Gb/s",
    "max_out_formatted": "332.96 Mb/s",
    "time_range_seconds": 2419200,
    "data_type": "bits"
  },
  "data": [
    {
      "timestamp": 1706745600000,
      "traffic_in": 2865780562,
      "traffic_out": 28076045
    }
  ]
}
```
