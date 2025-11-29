// api/notify-pendaftar.js
const sgMail = require('@sendgrid/mail');
const { createClient } = require('@supabase/supabase-js');

// Konfigurasi
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { tbm_id, user_pendaftar_id, nama_tbm, status, catatan } = req.body;

    if (!user_pendaftar_id || !status || !tbm_id) {
        return res.status(400).json({ error: 'Data tidak lengkap (Butuh ID User & ID TBM).' });
    }

    try {
        // 1. Ambil Data User (Pemilik Akun)
        const { data: userData, error: userError } = await supabaseAdmin
            .from('user_profiles')
            .select('email, username')
            .eq('id', user_pendaftar_id)
            .single();

        if (userError || !userData) throw new Error('User pendaftar tidak ditemukan.');

        // 2. Ambil Data TBM (Email, Nama Pendaftar, dan KABUPATEN)
        // PERUBAHAN: Kita ambil kabupaten_nama untuk identitas PD
        const { data: tbmData, error: tbmError } = await supabaseAdmin
            .from('tbm')
            .select('tbm_email, nama_pendaftar, kabupaten_nama') 
            .eq('id', tbm_id)
            .single();

        if (tbmError) console.warn("Gagal ambil data TBM:", tbmError.message);

        // Gabungkan Penerima
        const recipients = [userData.email];
        if (tbmData && tbmData.tbm_email && tbmData.tbm_email !== userData.email) {
            recipients.push(tbmData.tbm_email);
        }

        // --- LOGIKA PRIVASI NAMA VERIFIKATOR (LEVEL PD) ---
        const accountUsername = userData.username;
        const formPendaftarName = tbmData ? tbmData.nama_pendaftar : 'Pengelola';
        
        // Gunakan nama KABUPATEN dari data TBM
        const regionName = tbmData ? tbmData.kabupaten_nama : '';
        const signerName = `Pengurus Daerah ${regionName}`; 

        // 3. Tentukan Konten Dinamis
        let subject = '';
        let title = '';
        let messageBody = '';
        let colorTheme = ''; 
        let bgColorTheme = ''; 
        let buttonText = '';
        
        // Ganti URL sesuai production nanti
        const buttonUrl = 'http://localhost:3000/dashboard-pendaftar.html'; 

        if (status === '3_DISETUJUI') {
            subject = `[Disetujui] Status Pendaftaran TBM: ${nama_tbm} Lolos Verifikasi Daerah`;
            title = 'Pendaftaran Disetujui PD';
            colorTheme = '#10b981'; // Hijau Emerald (Tetap)
            bgColorTheme = '#ecfdf5'; // Hijau tipis (Tetap)
            buttonText = 'Cek Status di Dashboard';
            
            // PERUBAHAN TEKS: Diteruskan ke Pengurus Wilayah
            messageBody = `
                <p>Selamat! Pendaftaran TBM <strong>${nama_tbm}</strong> telah <strong>DISETUJUI</strong> oleh ${signerName}.</p>
                
                <div style="background-color: ${bgColorTheme}; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${colorTheme};">
                    Data Anda kini telah diteruskan ke <strong>Pengurus Wilayah (Provinsi)</strong> untuk proses validasi selanjutnya sebelum penerbitan SK dan Kartu Anggota Digital.
                </div>
            `;

        } else if (status === '4_DITOLAK') {
            subject = `[Ditolak] Status Pendaftaran TBM: ${nama_tbm}`;
            title = 'Pendaftaran Ditolak';
            colorTheme = '#ef4444'; // Merah (Tetap)
            bgColorTheme = '#fef2f2'; // Merah tipis (Tetap)
            buttonText = 'Cek Status di Dashboard';
            
            messageBody = `
                <p>Mohon maaf, pendaftaran TBM <strong>${nama_tbm}</strong> belum dapat disetujui oleh ${signerName}.</p>
                
                <div style="background-color: ${bgColorTheme}; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${colorTheme};">
                    <strong style="color: ${colorTheme}">Alasan Penolakan:</strong><br>
                    ${catatan}
                </div>
                
                <p>Silakan perbaiki data Anda sesuai catatan di atas dan lakukan pendaftaran ulang jika diperlukan.</p>
            `;
        }

        // 4. Template HTML Konsisten (Tidak Berubah Desain)
        const htmlContent = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                
                <div style="padding: 20px 30px; background-color: #ffffff; border-bottom: 3px solid ${colorTheme};">
                    <h2 style="color: ${colorTheme}; margin: 0; font-size: 20px;">${title}</h2>
                </div>

                <div style="padding: 30px;">
                    <p>Halo <strong>${accountUsername}</strong> & ${formPendaftarName},</p>
                    
                    ${messageBody}

                    <div style="margin-top: 30px; text-align: center;">
                        <a href="${buttonUrl}" 
                           style="background-color: ${colorTheme}; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: bold; font-size: 14px;">
                           ${buttonText}
                        </a>
                    </div>
                </div>

                <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
                    <p style="margin: 0;">Email otomatis dari Sistem Forum TBM.</p>
                </div>
            </div>
        `;

        // 5. Kirim Email
        const msg = {
            to: recipients,
            from: { name: 'Forum TBM', email: 'asisten@weathrly.web.id' }, 
            subject: subject,
            html: htmlContent,
        };

        await sgMail.sendMultiple(msg);

        return res.status(200).json({
            success: true,
            message: `Notifikasi dikirim ke: ${recipients.join(', ')}`
        });

    } catch (err) {
        console.error('Error sending email:', err);
        return res.status(500).json({ error: err.message });
    }
};