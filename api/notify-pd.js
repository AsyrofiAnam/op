// api/notify-pd.js
const sgMail = require('@sendgrid/mail');
const { createClient } = require('@supabase/supabase-js');

// Inisialisasi Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Gunakan Service Role Key agar bisa cari user by metadata/profile
const supabase = createClient(supabaseUrl, supabaseKey);

// Inisialisasi SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async (req, res) => {
    // 1. Validasi Method
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Ambil Data dari Request Frontend
    const { nama_tbm, nama_pendaftar, provinsi, kabupaten, email_tbm } = req.body;

    if (!nama_tbm || !kabupaten) {
        return res.status(400).json({ error: 'Data tidak lengkap. Nama TBM dan Kabupaten wajib ada.' });
    }

    try {
        // 3. Cari Email Pengurus Daerah (PD) sesuai Kabupaten
        // Logika: Cari di tabel user_profiles yang role='PD' DAN wilayah sama dengan kabupaten pendaftar
        const { data: listPD, error } = await supabase
            .from('user_profiles')
            .select('email, username')
            .eq('role', 'PD')
            .ilike('wilayah', kabupaten); // ilike agar tidak sensitif huruf besar/kecil

        if (error) throw error;

        // 4. Handle Jika PD Tidak Ditemukan
        if (!listPD || listPD.length === 0) {
            console.log(`Tidak ada PD ditemukan untuk wilayah: ${kabupaten}`);
            // Opsional: Bisa forward ke PW atau PP jika PD kosong (tapi untuk sekarang kita skip dulu)
            return res.status(200).json({ message: 'Data tersimpan, tapi tidak ada PD untuk dinotifikasi.' });
        }

        const emailsPD = listPD.map(pd => pd.email);

        // 5. Konfigurasi Email
        const colorTheme = '#eab308'; // Kuning/Oranye (Warna khas Level Daerah/Verifikasi Awal)
        const title = 'Verifikasi Pendaftaran Baru';
        
        // Ganti URL ini dengan domain produksimu nanti
        const buttonUrl = 'http://localhost:3000/dashboard-pd.html'; 
        
        const htmlContent = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                
                <div style="padding: 20px 30px; background-color: #ffffff; border-bottom: 3px solid ${colorTheme};">
                    <h2 style="color: #854d0e; margin: 0; font-size: 20px;">${title}</h2>
                </div>

                <div style="padding: 30px;">
                    <p>Halo Pengurus Daerah <strong>${kabupaten}</strong>,</p>
                    <p>Ada pendaftaran TBM baru di wilayah Anda yang menunggu verifikasi Anda.</p>
                    
                    <div style="background-color: #fefce8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${colorTheme};">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 5px 0; color: #854d0e; width: 100px;">Nama TBM</td>
                                <td style="padding: 5px 0; font-weight: bold;">: ${nama_tbm}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #854d0e;">Pendaftar</td>
                                <td style="padding: 5px 0; font-weight: bold;">: ${nama_pendaftar}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #854d0e;">Lokasi</td>
                                <td style="padding: 5px 0; font-weight: bold;">: ${kabupaten}, ${provinsi}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #854d0e;">Email TBM</td>
                                <td style="padding: 5px 0; font-weight: bold;">: ${email_tbm}</td>
                            </tr>
                        </table>
                    </div>

                    <p>Silakan login ke Dashboard PD untuk memverifikasi data ini.</p>
                    
                    <div style="margin-top: 30px; text-align: center;">
                        <a href="${buttonUrl}" 
                            style="background-color: ${colorTheme}; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: bold; font-size: 14px; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                           Buka Dashboard PD
                        </a>
                    </div>
                </div>

                <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
                    <p style="margin: 0;">Email otomatis dari Sistem Forum TBM.</p>
                </div>
            </div>
        `;

        const msg = {
            to: emailsPD,
            from: { name: 'Forum TBM', email: 'asisten@weathrly.web.id' }, // Pastikan sender verified
            subject: `[Verifikasi] Pendaftaran Baru: ${nama_tbm}`,
            html: htmlContent,
        };

        // 6. Kirim Email
        await sgMail.sendMultiple(msg);

        return res.status(200).json({ success: true, message: `Notifikasi dikirim ke ${emailsPD.length} pengurus daerah.` });

    } catch (err) {
        console.error('Error backend:', err);
        return res.status(500).json({ error: err.message });
    }
};