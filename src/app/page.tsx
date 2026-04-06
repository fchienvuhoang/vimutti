"use client";

import { useState, useMemo } from "react";
import { parseExcelBankStatement } from "@/lib/excelParser";
import { Category, ParsedRecord } from "@/lib/types";
import {
  UploadCloud,
  FileSpreadsheet,
  Plus,
  Trash2,
  Tag,
  Search,
  Filter,
  CheckCircle,
  Pencil,
  Copy,
  Check,
  Loader2,
  Save,
  Sparkles
} from "lucide-react";

const TABLE_COLUMNS = [
  { label: "Số tham chiếu", key: "soThamChieu" as keyof ParsedRecord },
  { label: "Ngày giờ", key: "ngayGioGiaoDich" as keyof ParsedRecord },
  { label: "Loại giao dịch", key: "loaiGiaoDich" as keyof ParsedRecord },
  { label: "Ngân hàng", key: "nganHang" as keyof ParsedRecord },
  { label: "Số tài khoản", key: "soTaiKhoan" as keyof ParsedRecord },
  { label: "Tên chủ tài khoản", key: "tenChuTaiKhoan" as keyof ParsedRecord },
  { label: "Chi tiết giao dịch", key: "chiTietGiaoDich" as keyof ParsedRecord },
  { label: "Tiền ra", key: "tienRa" as keyof ParsedRecord },
  { label: "Tiền vào", key: "tienVao" as keyof ParsedRecord },
  { label: "Ghi chú", key: "ghiChu" as keyof ParsedRecord },
];

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [appliedCategories, setAppliedCategories] = useState<Category[]>([]);
  const [records, setRecords] = useState<ParsedRecord[]>([]);

  // Form states for category
  const [newCatKeywords, setNewCatKeywords] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Tab & UI status states
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isApplying, setIsApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [copiedTab, setCopiedTab] = useState(false);

  const handleAddOrEditCategory = () => {
    // Split by comma, trim whitespace, and remove empty
    const keywords = newCatKeywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) return;

    // Use the first keyword as the category name, capitalized
    const generatedName = keywords[0].toUpperCase();

    if (editingId) {
      setCategories(categories.map(c => c.id === editingId ? { ...c, name: generatedName, keywords } : c));
      setEditingId(null);
    } else {
      const newCategory: Category = {
        id: crypto.randomUUID(),
        name: generatedName,
        keywords,
      };
      setCategories([...categories, newCategory]);
    }
    
    // Reset form
    setNewCatKeywords("");
  };

  const handleEditCategory = (cat: Category) => {
    setNewCatKeywords(cat.keywords.join(", "));
    setEditingId(cat.id);
  };

  const handleRemoveCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setNewCatKeywords("");
    }
  };

  const handleApplyCategories = () => {
    setIsApplying(true);
    setApplyMessage("");
    setTimeout(() => {
      // Save to the applied state which drives the matching logic
      setAppliedCategories([...categories]);
      // If active tab doesn't exist anymore, reset to "all"
      if (!categories.find(c => c.id === activeTab) && activeTab !== "all" && activeTab !== "uncategorized") {
        setActiveTab("all");
      }
      setIsApplying(false);
      setApplyMessage("Đã phân loại xong dữ liệu!");
      setTimeout(() => setApplyMessage(""), 4000);
    }, 600); // 600ms loading simulation
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelBankStatement(file);
      setRecords(parsed);
    } catch (error) {
      console.error("Error parsing file", error);
      alert("Đã xảy ra lỗi khi đọc file Excel.");
    }
  };

  const handleCopyTable = () => {
    if (filteredRecords.length === 0) return;
    
    // Headers
    const headers = [...TABLE_COLUMNS.map(c => c.label), "Phân Loại"].join("\t");
    // Rows
    const rows = filteredRecords.map(record => {
       const rowStr = TABLE_COLUMNS.map(col => {
         let val = record[col.key];
         // Replacing newlines so it doesn't break Excel TSV rows
         return String(val || "").replace(/\n/g, " "); 
       }).join("\t");
       const matchedName = record.matchedCategoryId ? (appliedCategories.find(c => c.id === record.matchedCategoryId)?.name || "Không khớp") : "Không khớp";
       return rowStr + "\t" + matchedName;
    }).join("\n");
    
    navigator.clipboard.writeText(headers + "\n" + rows);
    setCopiedTab(true);
    setTimeout(() => setCopiedTab(false), 2000);
  };

  // Compute matches
  const computedRecords = useMemo(() => {
    return records.map((record) => {
      let matchedCategoryId: string | undefined = undefined;

      // Find the first category that has a keyword matching the search text
      for (const cat of appliedCategories) {
        for (const kw of cat.keywords) {
          // Normalize both strings by removing spaces, dashes, dots, and underscores for extremely forgiving matching
          const searchNorm = record.searchText.toLowerCase().replace(/[\s\-_.+,/#!$%^&*;:{}=\\`~()]/g, '');
          const kwNorm = kw.toLowerCase().replace(/[\s\-_.+,/#!$%^&*;:{}=\\`~()]/g, '');

          if (searchNorm.includes(kwNorm)) {
            matchedCategoryId = cat.id;
            break; // Stop checking keywords for this category
          }
        }
        if (matchedCategoryId) break; // Stop checking other categories if matched
      }

      return { ...record, matchedCategoryId };
    });
  }, [records, appliedCategories]);

  // Filter records based on active tab
  const filteredRecords = useMemo(() => {
    if (activeTab === "all") return computedRecords;
    if (activeTab === "uncategorized")
      return computedRecords.filter((r) => !r.matchedCategoryId);
    
    return computedRecords.filter((r) => r.matchedCategoryId === activeTab);
  }, [computedRecords, activeTab]);

  // Auto-generate suggestions from chiTietGiaoDich
  const suggestedKeywords = useMemo(() => {
    if (records.length === 0) return [];
    
    const STOP_WORDS = new Set([
      "chuyển", "chuyen", "tiền", "tien", "ck", "cho", "thanh", "toán", "toan", "từ", "tu", 
      "tk", "tài", "khoản", "tai", "khoan", "ngân", "hàng", "ngan", "hang", "nh", "đến", "den", 
      "vào", "vao", "ra", "phí", "phi", "gd", "giao", "dịch", "dich", "số", "so", "thẻ", "the", 
      "qua", "mb", "vcb", "bidv", "tcb", "vietcombank", "techcombank", "mbbank", "ngày", "ngay", 
      "tháng", "thang", "năm", "nam", "ibft", "nạp", "nap", "rút", "rut", "phát", "sinh", "phat", 
      "chi", "thu", "của", "cua", "nhận", "nhan", "gửi", "gui", "qrvn", "vnpay", "mã", "ma", "vietinbank", "agribank"
    ]);

    const counts: Record<string, number> = {};
    
    records.forEach(r => {
      const text = r.chiTietGiaoDich.toLowerCase().trim();
      if (!text) return;

      // Extract words without stripping out numbers too early so bigrams are built correctly
      const words = text
        .replace(/[.,/#!$%^&*;:{}=\-_`~()+\\|\n]/g, " ")
        .split(/\s+/)
        .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
      
      // 1-grams (ignore standalone numbers)
      words.forEach(w => { 
        if (!/^\d+$/.test(w)) {
           counts[w] = (counts[w] || 0) + 1; 
        }
      });

      // 2-grams (ignore pure numbers combined like '123 456')
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = words[i] + " " + words[i+1];
        if (!/^\d+\s\d+$/.test(bigram)) {
           counts[bigram] = (counts[bigram] || 0) + 1;
        }
      }
    });

    return Object.entries(counts)
      .filter(([word, count]) => count > 1) // appear more than once
      .sort((a, b) => {
         const aHasTp = a[0].startsWith('tp');
         const bHasTp = b[0].startsWith('tp');
         if (aHasTp && !bHasTp) return -1;
         if (!aHasTp && bHasTp) return 1;
         // Secondary sort by frequency
         return b[1] - a[1];
      })
      .slice(0, 15) // top 15 suggestions
      .map(entry => entry[0]);
  }, [records]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 md:p-10 font-sans">
      <header className="mb-10 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Phân Tích File Sao Kê Ngân Hàng
        </h1>
        <p className="text-gray-500 mt-2">
          Bóc tách thông tin thiện pháp dựa trên từ khóa khớp với nội dung giao dịch.
        </p>
      </header>

      <main className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* TOP SECTION: Cards side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* File Upload Panel */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
              Tải Lên Sao Kê
            </h2>
            <div className="flex-1 border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors hover:bg-gray-50 min-h-[250px]">
              <FileSpreadsheet className="w-10 h-10 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-4">
                Kéo thả file .xlsx vào đây hoặc nhấn để chọn
              </p>
              <label className="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                Chọn file Excel
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            {records.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                <Search className="w-4 h-4 flex-shrink-0" />
                <p>Đã đọc thành công {records.length} dòng dữ liệu. Bạn hãy thiết lập và áp dụng từ khóa để lọc dữ liệu.</p>
              </div>
            )}
          </section>

          {/* Keyword Management Panel */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-600" />
              Cài Đặt Thiện Pháp
            </h2>
            
            {/* Add form */}
            <div className={`bg-gray-50 rounded-xl p-4 border mb-4 transition-colors ${editingId ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100'}`}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Danh Sách Từ Khóa (cách nhau bởi dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={newCatKeywords}
                    onChange={(e) => setNewCatKeywords(e.target.value)}
                    placeholder="tp44, hoa sen, ..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    onKeyDown={(e) => {
                       if (e.key === 'Enter') handleAddOrEditCategory();
                    }}
                  />
                  {suggestedKeywords.length > 0 && (
                    <div className="mt-3 bg-white p-2 rounded border border-gray-100">
                       <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 mb-2">
                         <Sparkles className="w-3 h-3" />
                         Gợi ý từ khóa thông minh (Nhấn để thêm):
                       </span>
                       <div className="flex flex-wrap gap-1.5">
                         {suggestedKeywords.map((kw, i) => (
                           <button
                             key={i}
                             onClick={() => {
                               const current = newCatKeywords.trim();
                               setNewCatKeywords(current ? current + ", " + kw : kw);
                             }}
                             className="text-[11px] bg-amber-50 text-amber-700 px-2 py-1 rounded hover:bg-amber-100 transition cursor-pointer"
                           >
                             {kw}
                           </button>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAddOrEditCategory}
                    className="w-full flex items-center justify-center cursor-pointer gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                  >
                    {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingId ? "Lưu Chỉnh Sửa" : "Thêm Nhóm Từ Khóa"}
                  </button>
                  {editingId && (
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setNewCatKeywords("");
                      }}
                      className="whitespace-nowrap px-4 py-2 cursor-pointer bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition"
                    >
                      Hủy Sửa
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List of draft categories */}
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[250px] mb-4 pr-1">
              {categories.map((cat) => (
                <div key={cat.id} className="border border-gray-200 rounded-xl p-3 hover:shadow-sm transition bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-sm text-gray-900">{cat.name}</h3>
                    <div className="flex gap-1 -mt-1">
                      <button
                        onClick={() => handleEditCategory(cat)}
                        className="text-gray-400 hover:text-blue-500 transition p-1 cursor-pointer"
                        title="Sửa"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveCategory(cat.id)}
                        className="text-gray-400 hover:text-red-500 transition p-1 cursor-pointer"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.keywords.map((kw, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] px-2 py-1 rounded-md font-medium">
                        <Tag className="w-3 h-3" />
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="text-sm text-center text-gray-500 py-4">
                  Chưa có nhóm từ khóa nào được thiết lập.
                </div>
              )}
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApplyCategories}
              disabled={isApplying}
              className={`w-full relative mt-auto flex items-center justify-center cursor-pointer gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg text-base font-semibold transition shadow-sm ${
                isApplying ? 'bg-indigo-500 cursor-wait' : 'hover:bg-indigo-700'
              }`}
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang phân loại...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Áp Dụng Phân Loại
                </>
              )}
            </button>
            
            {/* Success Banner */}
            <div
              className={`mt-4 overflow-hidden transition-all duration-300 ease-in-out ${
                applyMessage ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                {applyMessage}
              </div>
            </div>

          </section>
        </div>

        {/* BOTTOM SECTION: Results & Display */}
        <div className="w-full">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px] flex flex-col relative">
            
            <div className="flex flex-col sm:flex-row border-b border-gray-200 bg-gray-50">
                {/* Tabs */}
                <div className="flex-1 p-2 flex gap-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab("all")}
                    className={`flex-shrink-0 cursor-pointer px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === "all" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600 hover:bg-gray-100"
                    }`}
                >
                    Tất cả ({computedRecords.length})
                </button>
                {appliedCategories.map(cat => (
                    <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id)}
                    className={`flex-shrink-0 cursor-pointer px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === cat.id ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600 hover:bg-gray-100"
                    }`}
                    >
                    {cat.name} ({computedRecords.filter(r => r.matchedCategoryId === cat.id).length})
                    </button>
                ))}
                <button
                    onClick={() => setActiveTab("uncategorized")}
                    className={`flex-shrink-0 cursor-pointer px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === "uncategorized" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600 hover:bg-gray-100"
                    }`}
                >
                    Chưa phân loại ({computedRecords.filter(r => !r.matchedCategoryId).length})
                </button>
                </div>

                {/* Copy Button */}
                <div className="p-2 border-t sm:border-t-0 sm:border-l border-gray-200 flex items-center justify-end">
                  <button
                    onClick={handleCopyTable}
                    className="flex-shrink-0 flex items-center cursor-pointer gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition"
                  >
                    {copiedTab ? (
                      <>
                        <Check className="w-4 h-4 text-green-400" />
                        Đã Copy!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy bảng {activeTab === "all" ? "chưa phân loại" : "dữ liệu Tab này"}
                      </>
                    )}
                  </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-0">
              {filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20 min-h-[300px]">
                  <FileSpreadsheet className="w-12 h-12 mb-3 opacity-20" />
                  <p>Không có dữ liệu hiển thị.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-gray-50 sticky top-0 bg-white border-b border-gray-200 z-10">
                    <tr>
                      {TABLE_COLUMNS.map((col, i) => (
                        <th key={i} className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap border-l border-gray-100 bg-gray-50">
                        Phân Loại
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRecords.map((record, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50/50 transition-colors">
                        {TABLE_COLUMNS.map((col, colIndex) => {
                          const val = record[col.key];
                          let displayVal = String(val || "");
                          let className = "px-4 py-3 text-gray-700 min-w-[120px]";

                          if (col.key === "chiTietGiaoDich") {
                            className = "px-4 py-3 text-gray-700 min-w-[250px] whitespace-pre-wrap break-words leading-relaxed";
                          } else if (col.key === "tienRa" || col.key === "tienVao") {
                            if (val !== "" && val !== null && val !== undefined) {
                              const numVal = Number(val);
                              if (!isNaN(numVal)) {
                                displayVal = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numVal);
                              }
                            }
                            className = "px-4 py-3 text-gray-700 font-medium whitespace-nowrap text-right";
                          } else {
                            className = "px-4 py-3 text-gray-700 whitespace-nowrap";
                          }
                          
                          return (
                            <td key={colIndex} className={className}>
                              {displayVal}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 border-l border-gray-100 bg-gray-50/50 whitespace-nowrap">
                          {record.matchedCategoryId ? (
                            <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded-md font-medium text-xs">
                              {appliedCategories.find(c => c.id === record.matchedCategoryId)?.name}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Không khớp</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
          </section>
        </div>
      </main>
    </div>
  );
}
