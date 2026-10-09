# Option 4: 1 EC2 Web + 1 Managed RDS Database (Recommended)

Hạ tầng và Mã nguồn ứng dụng độc lập cho **Option 4: 1 EC2 Web + 1 Managed RDS Database (Recommended)**.

## 1. Cấu trúc thư mục (File Structure)
```text
.
├── .github/workflows/ci-cd.yml   # CI/CD Pipeline (test code, lint CloudFormation, auto-deploy)
├── app/                          # Mã nguồn Website độc lập (Node.js/Express)
├── infra/                        # Mã nguồn CloudFormation hạ tầng AWS
│   ├── cloudformation.yaml       # Template CloudFormation độc lập
│   └── architecture_diagram.png  # Sơ đồ kiến trúc Diagram-as-Code
├── test/                         # Kiểm thử tự động (Unit test API & app)
│   └── test_api.js
└── README.md                     # Báo cáo kỹ thuật và ma trận chi phí
```

## 2. Báo cáo Chi phí Đa Chiều (Multi-Dimension Cost Analysis)

### A. Chi phí theo Mô hình Mua & Tối ưu hóa (Region Singapore)
| Mô hình thanh toán | Web Compute (EC2) | RDS Managed (MySQL) | Storage, IP & Backup | Tổng chi phí / tháng | Quy đổi VNĐ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **On-Demand (Mặc định)** | $15.18 | $23.36 (`db.t4g.small`) | $9.10 | **$47.64 / tháng** | ~1.203.000 VNĐ |
| **1-Year Savings Plan / RI** | $9.56 | $16.82 | $9.10 | **$35.48 / tháng** *(Giảm 25%)* | ~895.000 VNĐ |
| **3-Year Savings Plan / RI** | $6.06 | $11.92 | $9.10 | **$27.08 / tháng** *(Giảm 43%)* | ~684.000 VNĐ |
| **Tiết kiệm (Dùng db.t3.micro)** | $15.18 | $20.00 | $9.10 | **$44.28 / tháng** | ~1.118.000 VNĐ |

### B. So sánh theo Vùng địa lý (Region Comparison)
- **Singapore (`ap-southeast-1`):** $47.64 / tháng (Độ trễ thấp nhất cho thị trường VN: ~30ms).
- **US East (`us-east-1`):** $42.15 / tháng (Rẻ hơn 11.5% do giá compute & RDS tại Mỹ thấp hơn).

<!-- INFRACOST_START -->
### 💵 Kết quả Kiểm tra Chi phí Tự động (Infracost CI/CD Output)
*Thời gian kiểm tra: Fri Oct  9 06:04:39 UTC 2026*

```text
No costed resources detected.
```
<!-- INFRACOST_END -->

## 3. Kiến trúc Hạ tầng (Architecture Diagram)
![Architecture](infra/architecture_diagram.png)

## 4. Quy trình CI/CD & Branching Strategy
- **dev**: Nhánh phát triển chính. Tự động chạy kiểm thử khi push/PR.
- **main**: Nhánh Production được bảo vệ (**Branch Protection Rule**). Chỉ cho phép merge từ nhánh **dev**.

## 🔒 Bảo Mật & Quản Lý Trạng Thái Hạ Tầng (Terraform State on S3)
Toàn bộ trạng thái hạ tầng được lưu trữ và bảo vệ nghiêm ngặt:
- **Lưu trữ từ xa (Remote State):** Amazon S3 Bucket `coderpush-terraform-states-ap-southeast-1`.
- **Mã hóa dữ liệu tại chỗ (Encryption at Rest):** Bật mã hóa `encrypt = true` (AES-256) ngăn ngừa mọi truy cập trái phép.
- **Khóa trạng thái (State Locking):** Tích hợp Amazon DynamoDB Table `coderpush-terraform-locks` ngăn xung đột khi nhiều kỹ sư hoặc pipeline chạy đồng thời.
- **Phân tách môi trường:** Khóa phân lập `environments/dev.tfvars` và `environments/prod.tfvars`.
