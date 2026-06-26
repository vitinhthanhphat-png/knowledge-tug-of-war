import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the header and sample row
const data = [
  ['STT', 'Câu hỏi', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 'Câu đúng'],
  [1, 'Thủ đô của Việt Nam là gì?', 'Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Hải Phòng', 'B']
];

// Create a new workbook and a new worksheet
const wb = xlsx.utils.book_new();
const ws = xlsx.utils.aoa_to_sheet(data);

// Adjust column widths
ws['!cols'] = [
  { wch: 5 },  // STT
  { wch: 40 }, // Câu hỏi
  { wch: 20 }, // Đáp án A
  { wch: 20 }, // Đáp án B
  { wch: 20 }, // Đáp án C
  { wch: 20 }, // Đáp án D
  { wch: 10 }  // Câu đúng
];

// Add the worksheet to the workbook
xlsx.utils.book_append_sheet(wb, ws, 'Template');

// Ensure the public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write the file
const outputPath = path.join(publicDir, 'template_dautruongkienthuc.xlsx');
xlsx.writeFile(wb, outputPath);

console.log(`Successfully generated template at ${outputPath}`);
