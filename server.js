const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.nes', '.gb', '.gbc', '.gba', '.smc', '.sfc', '.md', '.gen', '.a26', '.bin', '.zip'];
        const fileExt = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(fileExt)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only ROM files are allowed.'));
        }
    }
});

// ROM database (in production, use a real database)
const romDatabase = {
    'super-mario-bros.nes': { name: 'Super Mario Bros', system: 'NES' },
    'zelda.nes': { name: 'The Legend of Zelda', system: 'NES' },
    'pokemon-red.gb': { name: 'Pokemon Red', system: 'Game Boy' },
    // Add more ROM signatures as needed
};

// Helper function to identify ROM
function identifyROM(filename, buffer) {
    // Simple identification by filename (in production, use proper ROM header parsing)
    const knownRoms = Object.keys(romDatabase);
    const found = knownRoms.find(rom => filename.toLowerCase().includes(rom.replace('.nes', '').replace('.gb', '')));
    
    if (found) {
        return romDatabase[found];
    }
    
    // Fallback: extract name from filename
    const name = path.basename(filename, path.extname(filename))
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    
    return { name: name, system: 'Unknown' };
}

// Routes
app.post('/api/upload', upload.single('rom'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        // Identify the ROM
        const romInfo = identifyROM(req.file.originalname, req.file.buffer);

        res.json({
            success: true,
            filename: req.file.filename,
            originalName: req.file.originalname,
            gameName: romInfo.name,
            system: romInfo.system,
            size: req.file.size
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/load-rom', (req, res) => {
    try {
        const { filename } = req.body;
        
        if (!filename) {
            return res.status(400).json({ success: false, error: 'Filename required' });
        }

        const filePath = path.join('uploads', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'ROM file not found' });
        }

        // Read the ROM file
        const romData = fs.readFileSync(filePath);
        
        // Convert to base64 for transmission
        const base64Data = romData.toString('base64');
        
        res.json({
            success: true,
            romData: base64Data,
            filename: filename
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/roms', (req, res) => {
    try {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            return res.json({ success: true, roms: [] });
        }

        const files = fs.readdirSync(uploadDir);
        const roms = files.map(file => {
            const romInfo = identifyROM(file, null);
            return {
                filename: file,
                name: romInfo.name,
                system: romInfo.system,
                size: fs.statSync(path.join(uploadDir, file)).size
            };
        });

        res.json({ success: true, roms: roms });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/roms/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join('uploads', filename);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'ROM deleted successfully' });
        } else {
            res.status(404).json({ success: false, error: 'ROM not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
});
