<?php

/**
 * Script Chuẩn Hóa Tên Thư Mục
 * 
 * Script này đổi tên các thư mục trong src/ để phù hợp với PSR-4:
 * - core → Core
 * - modules → Modules
 * - contexts → Contexts
 * - shared → Shared
 * - support → Support
 * - infrastructure → Infrastructure
 */

class DirectoryStandardizer
{
    private array $mappings = [
        'core' => 'Core',
        'modules' => 'Modules',
        'contexts' => 'Contexts',
        'shared' => 'Shared',
        'support' => 'Support',
        'infrastructure' => 'Infrastructure',
    ];

    private string $baseDir;
    private int $directoriesRenamed = 0;
    private array $errors = [];

    public function __construct(string $baseDir = 'src')
    {
        $this->baseDir = $baseDir;
    }

    public function standardize(): void
    {
        echo "🚀 Bắt đầu chuẩn hóa tên thư mục...\n\n";

        if (!is_dir($this->baseDir)) {
            echo "❌ Thư mục {$this->baseDir} không tồn tại!\n";
            return;
        }

        foreach ($this->mappings as $old => $new) {
            $oldPath = $this->baseDir . '/' . $old;
            $newPath = $this->baseDir . '/' . $new;

            if (is_dir($oldPath)) {
                if (is_dir($newPath)) {
                    echo "⚠️  Thư mục {$newPath} đã tồn tại, bỏ qua {$oldPath}\n";
                    continue;
                }

                if (rename($oldPath, $newPath)) {
                    echo "✓ Đã đổi tên: {$old} → {$new}\n";
                    $this->directoriesRenamed++;
                } else {
                    $error = "❌ Không thể đổi tên: {$oldPath} → {$newPath}";
                    echo $error . "\n";
                    $this->errors[] = $error;
                }
            } else {
                echo "⚠️  Thư mục {$oldPath} không tồn tại, bỏ qua\n";
            }
        }

        echo "\n✅ Hoàn thành!\n";
        echo "📊 Thống kê:\n";
        echo "   - Số thư mục đã đổi tên: {$this->directoriesRenamed}\n";
        
        if (!empty($this->errors)) {
            echo "\n❌ Lỗi:\n";
            foreach ($this->errors as $error) {
                echo "   - {$error}\n";
            }
        }

        echo "\n💡 Lưu ý: Sau khi đổi tên thư mục, cần:\n";
        echo "   1. Cập nhật namespace trong tất cả file PHP\n";
        echo "   2. Chạy: composer dump-autoload\n";
        echo "   3. Cập nhật các đường dẫn trong config files\n";
    }
}

// Chạy standardization
if (php_sapi_name() === 'cli') {
    $standardizer = new DirectoryStandardizer('src');
    $standardizer->standardize();
} else {
    echo "Script này chỉ chạy được từ command line.\n";
}

