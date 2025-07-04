"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarIcon,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type DateRangeType = "month" | "custom";
type ExportFormat = "csv" | "xlsx";

export default function TransactionExportPage() {
  const router = useRouter();
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>("month");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [isExporting, setIsExporting] = useState(false);

  const exportQuery = trpc.transaction.export.useQuery(
    {
      format: exportFormat,
      dateRange:
        dateRangeType === "month"
          ? {
              from: format(
                new Date(
                  selectedMonth.getFullYear(),
                  selectedMonth.getMonth(),
                  1
                ),
                "yyyy-MM-dd"
              ),
              to: format(
                new Date(
                  selectedMonth.getFullYear(),
                  selectedMonth.getMonth() + 1,
                  0
                ),
                "yyyy-MM-dd"
              ),
            }
          : startDate && endDate
          ? {
              from: format(startDate, "yyyy-MM-dd"),
              to: format(endDate, "yyyy-MM-dd"),
            }
          : undefined,
      includeCategories: true,
    },
    {
      enabled: false,
    }
  );

  const handleExport = async () => {
    setIsExporting(true);

    try {
      if (dateRangeType === "custom" && (!startDate || !endDate)) {
        toast.error("Please select both start and end dates");
        setIsExporting(false);
        return;
      }

      if (
        dateRangeType === "custom" &&
        startDate &&
        endDate &&
        endDate < startDate
      ) {
        toast.error("End date cannot be earlier than start date");
        setIsExporting(false);
        return;
      }

      const result = await exportQuery.refetch();

      if (result.data) {
        if (exportFormat === "csv") {
          generateCSV(
            result.data as {
              data: {
                transactions: Array<{
                  bookedDate: string;
                  description?: string;
                  amount?: number;
                  currency?: string;
                  mainCategory?: string;
                  subCategory?: string;
                  accountName?: string;
                  merchantName?: string;
                  status?: string;
                  reference?: string;
                }>;
              };
              filename: string;
            }
          );
        } else {
          generateExcel(
            result.data as {
              data: {
                transactions: Array<{
                  bookedDate: string;
                  description?: string;
                  amount?: number;
                  currency?: string;
                  mainCategory?: string;
                  subCategory?: string;
                  accountName?: string;
                  merchantName?: string;
                  status?: string;
                  reference?: string;
                }>;
                grouped?: Record<
                  string,
                  Record<string, Array<{ amount?: number }>>
                >;
              };
              filename: string;
            }
          );
        }
        toast.success("Export completed successfully!");
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export transactions");
    } finally {
      setIsExporting(false);
    }
  };

  const generateCSV = (data: {
    data: {
      transactions: Array<{
        bookedDate: string;
        description?: string;
        amount?: number;
        currency?: string;
        mainCategory?: string;
        subCategory?: string;
        accountName?: string;
        merchantName?: string;
        status?: string;
        reference?: string;
      }>;
    };
    filename: string;
  }) => {
    const transactions = data.data.transactions;

    // CSV headers
    const headers = [
      "Date",
      "Description",
      "Amount",
      "Currency",
      "Category",
      "Sub-Category",
      "Account",
      "Merchant",
      "Status",
      "Reference",
    ];

    // Convert transactions to CSV rows
    const rows = transactions.map((txn) => [
      txn.bookedDate,
      txn.description || "",
      txn.amount?.toFixed(2) || "0.00",
      txn.currency || "",
      txn.mainCategory || "Uncategorized",
      txn.subCategory || "",
      txn.accountName || "",
      txn.merchantName || "",
      txn.status || "",
      txn.reference || "",
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row: string[]) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    // Download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = data.filename;
    link.click();
  };

  const generateExcel = async (data: {
    data: {
      transactions: Array<{
        bookedDate: string;
        description?: string;
        amount?: number;
        currency?: string;
        mainCategory?: string;
        subCategory?: string;
        accountName?: string;
        merchantName?: string;
        status?: string;
        reference?: string;
      }>;
      grouped?: Record<string, Record<string, Array<{ amount?: number }>>>;
    };
    filename: string;
  }) => {
    // Dynamic import for xlsx library
    const XLSX = await import("xlsx");

    const transactions = data.data.transactions;

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create transactions sheet
    const transactionData = transactions.map((txn) => ({
      Date: txn.bookedDate,
      Description: txn.description || "",
      Amount: txn.amount || 0,
      Currency: txn.currency || "",
      Category: txn.mainCategory || "Uncategorized",
      "Sub-Category": txn.subCategory || "",
      Account: txn.accountName || "",
      Merchant: txn.merchantName || "",
      Status: txn.status || "",
      Reference: txn.reference || "",
    }));

    const ws = XLSX.utils.json_to_sheet(transactionData);

    // Add formatting
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "FFFFAA00" } },
      };
    }

    XLSX.utils.book_append_sheet(wb, ws, "Transactions");

    // Create summary sheet if there's grouped data
    if (data.data.grouped) {
      const summaryData: Array<{
        Date: string;
        Category: string;
        "Transaction Count": number;
        "Total Amount": string;
      }> = [];

      Object.entries(data.data.grouped).forEach(([date, categories]) => {
        Object.entries(categories).forEach(([category, txns]) => {
          const totalAmount = txns.reduce(
            (sum: number, txn) => sum + (txn.amount || 0),
            0
          );
          summaryData.push({
            Date: date,
            Category: category,
            "Transaction Count": txns.length,
            "Total Amount": totalAmount.toFixed(2),
          });
        });
      });

      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
    }

    // Write file
    XLSX.writeFile(wb, data.filename);
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1
      );
      options.push({
        value: date.toISOString(),
        label: format(date, "MMMM yyyy"),
      });
    }

    return options;
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/transactions">
                    Transactions
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Export</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Export Transactions</h1>
              <p className="text-muted-foreground">
                Download your transaction data in CSV or Excel format
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/transactions")}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Transactions
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Date Range Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Date Range</CardTitle>
                <CardDescription>
                  Select the time period for your export
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={dateRangeType}
                  onValueChange={(value) =>
                    setDateRangeType(value as DateRangeType)
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="month" id="month" />
                    <Label htmlFor="month">By Month</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom">Custom Date Range</Label>
                  </div>
                </RadioGroup>

                {dateRangeType === "month" ? (
                  <Select
                    value={selectedMonth.toISOString()}
                    onValueChange={(value) => setSelectedMonth(new Date(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a month" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMonthOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate
                              ? format(startDate, "PPP")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            disabled={(date) =>
                              startDate ? date < startDate : false
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Export Format Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Export Format</CardTitle>
                <CardDescription>
                  Choose the file format for your export
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={exportFormat}
                  onValueChange={(value) =>
                    setExportFormat(value as ExportFormat)
                  }
                >
                  <div className="flex items-center space-x-4 rounded-lg border p-4 hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="csv" id="csv" />
                    <FileText className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1">
                      <Label htmlFor="csv" className="cursor-pointer">
                        <div className="font-medium">CSV Format</div>
                        <div className="text-sm text-muted-foreground">
                          Comma-separated values, compatible with most
                          spreadsheet applications
                        </div>
                      </Label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 rounded-lg border p-4 hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="xlsx" id="xlsx" />
                    <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1">
                      <Label htmlFor="xlsx" className="cursor-pointer">
                        <div className="font-medium">Excel Format (XLSX)</div>
                        <div className="text-sm text-muted-foreground">
                          Microsoft Excel workbook with formatted data and
                          categories
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Export Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Export Summary</CardTitle>
              <CardDescription>
                Your transactions will be exported with the following details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Date Range:</span>
                  <p className="font-medium">
                    {dateRangeType === "month"
                      ? format(selectedMonth, "MMMM yyyy")
                      : startDate && endDate
                      ? `${format(startDate, "PP")} - ${format(endDate, "PP")}`
                      : "Select dates"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Format:</span>
                  <p className="font-medium">{exportFormat.toUpperCase()}</p>
                </div>
              </div>
              <div className="pt-2 text-sm text-muted-foreground">
                The export will include transaction details grouped by category
                and date, including amounts, descriptions, and account
                information.
              </div>
            </CardContent>
          </Card>

          {/* Export Button */}
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleExport}
              disabled={isExporting}
              className="min-w-[200px]"
            >
              {isExporting ? (
                <>
                  <Download className="mr-2 h-4 w-4 animate-pulse" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export Transactions
                </>
              )}
            </Button>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
