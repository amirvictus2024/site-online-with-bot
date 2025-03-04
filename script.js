let locationsData = {};

// نمایش پیغام (Toast)
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// توابع کمکی برای تولید گروه‌های IPv6
function generateRandomGroup() {
  return Math.floor(Math.random() * 0x10000)
           .toString(16)
           .padStart(4, '0');
}

function generateLastGroup(fixed) {
  // انتخاب یک حرف تصادفی از مجموعه مجاز به جای رقم
  const allowedLetters = ['a', 'b', 'c', 'd', 'e', 'f'];
  const letter = allowedLetters[Math.floor(Math.random() * allowedLetters.length)];
  return fixed + letter;
}

// تولید آدرس DNS IPv6 به فرمت دلخواه
// فرمت نهایی: [group1]:[group2]:[rand4]:[rand4]:[rand2]::[rand4]:[fixed][letter]
function generateIPv6DNSCustom(prefix, fixed) {
  const prefixParts = prefix.split(':').filter(x => x !== '');
  const g1 = prefixParts[0] || "0000";
  const g2 = prefixParts[1] || "0000";
  const group3 = generateRandomGroup();
  const group4 = generateRandomGroup();
  const group5 = Math.floor(Math.random() * 0x100).toString(16).padStart(2, '0');
  const group7 = generateRandomGroup();
  const group8 = generateLastGroup(fixed);
  return `${g1}:${g2}:${group3}:${group4}:${group5}::${group7}:${group8}`;
}

// تولید آدرس IPv6 برای بخش Address بر مبنای پیشوند IPv6
function generateIPv6Address(prefix) {
  let parts = prefix.split(":").filter(x => x !== "");
  let g1 = parts[0] || "0000";
  let g2 = parts[1] || "0000";
  let group3 = generateRandomGroup();
  let group4 = generateRandomGroup();
  let group5 = generateRandomGroup();
  let group6 = generateRandomGroup();
  let group7 = generateRandomGroup();
  let group8 = generateRandomGroup();
  return `${g1}:${g2}:${group3}:${group4}:${group5}:${group6}:${group7}:${group8}`;
}

// تولید یک آدرس IPv4 تصادفی از رنج داده شده (به صورت CIDR)
function generateRandomIPv4(cidr) {
  let [ip, prefixLength] = cidr.split('/');
  prefixLength = parseInt(prefixLength, 10);
  const ipParts = ip.split('.').map(Number);
  let ipInt = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  let size = Math.pow(2, 32 - prefixLength);
  let offset = Math.floor(Math.random() * size);
  let randomIpInt = ipInt + offset;
  let randomIp = [
    (randomIpInt >>> 24) & 0xFF,
    (randomIpInt >>> 16) & 0xFF,
    (randomIpInt >>> 8) & 0xFF,
    randomIpInt & 0xFF
  ].join('.');
  return randomIp;
}

// بارگذاری اطلاعات لوکیشن از فایل JSON
function loadLocations() {
  fetch('locations.json')
    .then(response => response.json())
    .then(data => {
      locationsData = data;
      populateLocationCards();
      populateDNSLocationSelect();
      updateDNSOutput();
    })
    .catch(err => {
      console.error('Error loading locations.json:', err);
      showToast('خطا در بارگذاری اطلاعات لوکیشن', 'error');
    });
}

function populateLocationCards() {
  const locationsGrid = document.getElementById('locationsGrid');
  locationsGrid.innerHTML = '';
  for (const country in locationsData) {
    const data = locationsData[country];
    const card = document.createElement('div');
    card.className = 'location-card';
    card.innerHTML = `
      <img src="${data.flagUrl}" alt="${country}" class="flag-icon">
      <h3>${country}</h3>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.location-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      generateWireGuardConfig(country, data);
    });
    locationsGrid.appendChild(card);
  }
}

function populateDNSLocationSelect() {
  const dnsLocationSelect = document.getElementById('dnsLocation');
  dnsLocationSelect.innerHTML = '';
  for (const country in locationsData) {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    dnsLocationSelect.appendChild(option);
  }
  dnsLocationSelect.addEventListener('change', updateDNSOutput);
}

function generateKey() {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...key));
}

function downloadConfig(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename + '.conf';
  a.click();
  window.URL.revokeObjectURL(url);
}

// تولید فایل کانفیگ WireGuard با فرمت مورد نظر
// به جای دانلود خودکار، مشخصات کانفیگ در بخش output نمایش داده می‌شود همراه با دکمه دانلود
function generateWireGuardConfig(country, data) {
  const configName = document.getElementById('configName').value || 'wireguard-config';
  const privateKey = generateKey(); // کلید 32 بایتی Base64
  const publicKey = generateKey();

  // بخش Address:
  // ثابت: 10.202.10.10/32
  // IPv4: تولید تصادفی از رنج IPv4
  // IPv6: تولید بر مبنای پیشوند IPv6
  const wgIPv4 = generateRandomIPv4(data.ipv4Ranges[0]);
  const wgIPv6 = generateIPv6Address(data.ipv6Ranges[0].split('/')[0]);

  // بخش DNS:
  // ثابت: 78.157.42.100
  // IPv4: تولید تصادفی از رنج IPv4
  // IPv6: دو آدرس به فرمت دلخواه (با حرف آخر "1" و "0")
  const dnsIPv4 = generateRandomIPv4(data.ipv4Ranges[0]);
  const ipv6Prefix = data.ipv6Ranges[0].split('/')[0];
  const dnsIPv6_1 = generateIPv6DNSCustom(ipv6Prefix, '1');
  const dnsIPv6_2 = generateIPv6DNSCustom(ipv6Prefix, '0');

  // تولید Endpoint: از رنج IPv4 به صورت تصادفی + پورت 443
  const endpoint = generateRandomIPv4(data.ipv4Ranges[0]) + ":443";
  const allowedIPs = "0.0.0.0/8, ::/8";
  
  const config = `[Interface]
PrivateKey = ${privateKey}
Address = 10.202.10.10/32, ${wgIPv4}, ${wgIPv6}
DNS = 78.157.42.100, ${dnsIPv4}, ${dnsIPv6_1}, ${dnsIPv6_2}
MTU = 1280

[Peer]
PublicKey = ${publicKey}
AllowedIPs = ${allowedIPs}
Endpoint = ${endpoint}
PersistentKeepalive = 15`;
  
  // نمایش مشخصات کانفیگ در بخش output به همراه دکمه دانلود
  const configOutput = document.getElementById('configOutput');
  configOutput.innerHTML = `<pre>${config}</pre>
  <button class="button" id="downloadConfigBtn">دانلود کانفیگ</button>`;
  configOutput.style.display = 'block';
  
  document.getElementById('downloadConfigBtn').addEventListener('click', () => {
    downloadConfig(config, configName);
  });
}

function updateDNSOutput() {
  const dnsLocationSelect = document.getElementById('dnsLocation');
  const selectedLocation = dnsLocationSelect.value;
  const locationData = locationsData[selectedLocation];
  let ipv4, ipv6_1, ipv6_2;
  if (locationData) {
    ipv4 = generateRandomIPv4(locationData.ipv4Ranges[0]);
    const ipv6Prefix = locationData.ipv6Ranges[0].split('/')[0];
    ipv6_1 = generateIPv6DNSCustom(ipv6Prefix, '1');
    ipv6_2 = generateIPv6DNSCustom(ipv6Prefix, '0');
  } else {
    ipv4 = '1.1.1.1';
    const defaultPrefix = '2a01:4f8::';
    ipv6_1 = generateIPv6DNSCustom(defaultPrefix, '1');
    ipv6_2 = generateIPv6DNSCustom(defaultPrefix, '0');
  }
  const dnsOutput = document.getElementById('dnsOutput');
  dnsOutput.innerHTML = `
    <div class="dns-line">
      <strong>DNS IPv4:</strong> <span>${ipv4}</span>
      <span class="material-symbols-rounded copy-icon" onclick="navigator.clipboard.writeText('${ipv4}').then(() => showToast('کپی شد'))">content_copy</span>
    </div>
    <div class="dns-line">
      <strong>DNS IPv6:</strong> <span>${ipv6_1}</span>
      <span class="material-symbols-rounded copy-icon" onclick="navigator.clipboard.writeText('${ipv6_1}').then(() => showToast('کپی شد'))">content_copy</span>
    </div>
    <div class="dns-line">
      <strong>DNS IPv6:</strong> <span>${ipv6_2}</span>
      <span class="material-symbols-rounded copy-icon" onclick="navigator.clipboard.writeText('${ipv6_2}').then(() => showToast('کپی شد'))">content_copy</span>
    </div>
  `;
}

// مدیریت تغییر تب‌ها
document.querySelectorAll('.tab').forEach(tab => {
  if (tab.id !== 'themeSwitch') {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.getElementById('wireguardSection').style.display = 
          tabName === 'wireguard' ? 'block' : 'none';
      document.getElementById('dnsSection').style.display = 
          tabName === 'dns' ? 'block' : 'none';
      if (tabName === 'dns') {
        updateDNSOutput();
      }
    });
  }
});

// تغییر تم (روشن/تیره)
document.getElementById('themeSwitch').addEventListener('click', () => {
  document.body.classList.toggle('dark');
});

// دکمه تولید DNS
document.getElementById('generateDns').addEventListener('click', updateDNSOutput);

// تنظیم تم اولیه براساس تنظیمات سیستم
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.body.classList.add('dark');
}

// بارگذاری اطلاعات لوکیشن از فایل JSON
loadLocations();
