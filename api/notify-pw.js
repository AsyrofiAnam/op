// api/notify-pw.js
const sgMail = require('@sendgrid/mail');
const { createClient } = require('@supabase/supabase-js');

// Inisialisasi Supabase (Gunakan Service Role Key untuk akses user profile)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Inisialisasi SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async (req, res) => {
    // 1. Validasi Method
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Ambil Data
    const { nama_tbm, nama_pendaftar, provinsi, kabupaten, email_tbm } = req.body;

    if (!nama_tbm || !provinsi) {
        return res.status(400).json({ error: 'Data tidak lengkap. Nama TBM dan Provinsi wajib ada.' });
    }

    try {
        // 3. Cari Email Pengurus Wilayah (PW) sesuai Provinsi
        // Logika: Cari di tabel user_profiles yang role='PW' DAN wilayah sama dengan provinsi TBM
        const { data: listPW, error } = await supabase
            .from('user_profiles')
            .select('email, username')
            .eq('role', 'PW')
            .ilike('wilayah', provinsi); // ilike agar case-insensitive

        if (error) throw error;

        // 4. Handle Jika PW Tidak Ditemukan
        if (!listPW || listPW.length === 0) {
            console.log(`Tidak ada PW ditemukan untuk wilayah: ${provinsi}`);
            return res.status(200).json({ message: 'Status diupdate, tapi tidak ada PW untuk dinotifikasi.' });
        }

        const emailsPW = listPW.map(pw => pw.email);

        // 5. Konfigurasi Email
        // Menggunakan warna Biru Laut (mencerminkan level Wilayah/Provinsi)
        const colorTheme = '#0284c7'; 
        const title = 'Validasi TBM Lolos Verifikasi';
        const subject = `[Validasi] TBM Lolos Verifikasi: ${nama_tbm}`;
        
        // Ganti URL ini dengan domain produksimu nanti
        const buttonUrl = 'http://localhost:3000/dashboard-pw.html'; 
        
        const htmlContent = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                
                <div style="padding: 20px 30px; background-color: #ffffff; border-bottom: 3px solid ${colorTheme};">
                    <h2 style="color: ${colorTheme}; margin: 0; font-size: 20px;">${title}</h2>
                </div>

                <div style="padding: 30px;">
                    <p>Halo Pengurus Wilayah <strong>${provinsi}</strong>,</p>
                    <p>Pengurus Daerah (PD) <strong>${kabupaten}</strong> telah menyelesaikan verifikasi data TBM berikut dan kini menunggu Validasi Akhir dari Anda:</p>
                    
                    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${colorTheme};">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 5px 0; color: #555; width: 100px;">Nama TBM</td>
                                <td style="padding: 5px 0; font-weight: bold;">: ${nama_tbm}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #555;">Pendaftar</td>
                                <td style="padding: 5px 0; font-weight: bold;">: ${nama_pendaftar}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #555;">Lokasi</td>
                                <td style="padding: 5px 0; font-weight: bold;">: ${kabupaten}, ${provinsi}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #555;">Email TBM</td>
                                <td style="padding: 5px 0; font-weight: bold;">: ${email_tbm}</td>
                            </tr>
                        </table>
                    </div>

                    <p>Silakan login ke Dashboard PW untuk melakukan <strong>Validasi Akhir</strong> dan menerbitkan SK/Kartu Anggota.</p>
                    
                    <div style="margin-top: 30px; text-align: center;">
                        <a href="${buttonUrl}" 
                            style="background-color: ${colorTheme}; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px rgba(2, 132, 199, 0.2);">
                           Buka Dashboard PW
                        </a>
                    </div>
                </div>

                <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee;">
                    <p style="margin: 0;">Email otomatis dari Sistem Forum TBM.</p>
                </div>
            </div>
        `;

        const msg = {
            to: emailsPW,
            from: { name: 'Forum TBM', email: 'asisten@weathrly.web.id' }, 
            subject: subject,
            html: htmlContent,
        };

        // 6. Kirim Email
        await sgMail.sendMultiple(msg);

        return res.status(200).json({ success: true, message: `Notifikasi dikirim ke ${emailsPW.length} pengurus wilayah.` });

    } catch (err) {
        console.error('Error backend notify-pw:', err);
        return res.status(500).json({ error: err.message });
    }
};