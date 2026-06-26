import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const docsDir = path.join(__dirname, '..', 'docs', 'cmd');
const outputPath = path.join(__dirname, '..', 'src', 'generated', 'help-docs.ts');

// 确保输出目录存在
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 读取所有md文件
const files = fs.readdirSync(docsDir).filter(file => file.endsWith('.md'));

const helpDocs = {};

files.forEach(file => {
  const commandName = path.basename(file, '.md');
  const filePath = path.join(docsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 移除 <!-- Generated --> 标记
  let processedContent = content.replace(/<!-- Generated -->\r?\n/, '');
  
  // 移除标题行 # xan {command}
  processedContent = processedContent.replace(/^# xan .*\r?\n/, '');
  
  // 移除开头的空行
  processedContent = processedContent.replace(/^\r?\n/, '');
  
  helpDocs[commandName] = processedContent;
});

// 生成TypeScript文件
const tsContent = `// Auto-generated file - do not edit manually
// Run: node scripts/generate-help-docs.js to regenerate

export interface HelpDocs {
  [commandName: string]: string;
}

export const helpDocs: HelpDocs = ${JSON.stringify(helpDocs, null, 2)};

export const commandNames = ${JSON.stringify(Object.keys(helpDocs), null, 2)} as const;
`;

fs.writeFileSync(outputPath, tsContent, 'utf-8');

console.log(`✓ Generated help docs for ${files.length} commands`);
console.log(`  Output: ${outputPath}`);