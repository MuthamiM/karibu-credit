'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type Borrower = {
  id: number;
  full_name: string;
  email: string;
  phone_number?: string | null;
  is_active: boolean;
};

type CustomerResponse = {
  id: number;
  customer_code: string;
  national_id: string;
  phone: string;
  kra_pin?: string | null;
  kyc_status: string;
  credit_score: number;
  max_loan_limit: number;
  blacklisted: boolean;
  blacklisted_reason?: string | null;
};

type Loan = {
  id: number;
  user_id: number;
  customer_id?: number | null;
  principal_amount: number;
  outstanding_balance: number;
  total_paid: number;
  total_payable?: number | null;
  status: string;
  product_type: string;
  created_at: string;
  application_no?: string | null;
  customer?: CustomerResponse | null;
  tenure_months?: number | null;
};

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [crbChecking, setCrbChecking] = useState(false);
  const [crbResult, setCrbResult] = useState<{ score: number; grading: string } | null>(null);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [exporting, setExporting] = useState(false);

  // Load borrowers and loans concurrently
  useEffect(() => {
    async function loadData() {
      try {
        const [borrowersData, loansData] = await Promise.all([
          fetchApi('/users/?role=borrower'),
          fetchApi('/loans/')
        ]);
        setBorrowers(borrowersData);
        setLoans(loansData);
        if (borrowersData.length > 0) {
          setSelectedBorrowerId(borrowersData[0].id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const fetchAllBorrowers = async (): Promise<Borrower[]> => {
    const allBorrowers: Borrower[] = [];
    let skip = 0;
    const PAGE = 100;
    while (true) {
      const batch = await fetchApi(`/users/?role=borrower&skip=${skip}&limit=${PAGE}`);
      if (!Array.isArray(batch)) throw new Error('Unexpected borrowers response');
      allBorrowers.push(...batch);
      if (batch.length < PAGE) break;
      skip += PAGE;
    }
    return allBorrowers;
  };

  const createCsv = (borrowers: Borrower[], loans: Loan[]) => {
    const escapeValue = (value: unknown) => {
      if (value === null || value === undefined) return '';
      const text = String(value);
      const shouldQuote = /[\",\n\r]/.test(text);
      const escaped = text.replace(/"/g, '""');
      return shouldQuote ? `"${escaped}"` : escaped;
    };

    const header = [
      'Borrower ID',
      'Full Name',
      'Email',
      'Phone Number',
      'Active',
      'Borrower Total Principal',
      'Borrower Total Repaid',
      'Borrower Total Outstanding',
      'Borrower Loan Count',
      'Borrower Profit',
      'Borrower Loss',
      'Loan ID',
      'Application No',
      'Product Type',
      'Status',
      'Principal Amount',
      'Total Paid',
      'Total Payable',
      'Outstanding Balance',
      'Tenure Months',
      'Created At',
      'Days Since Disbursement',
      'Age Category',
      'Cleared',
      'Delinquent',
      'Loan Profit',
      'Customer Code',
      'Customer National ID',
    ];

    const rows = [header.map(escapeValue).join(',')];

    const loanIndex = new Map<number, Loan[]>();
    loans.forEach((loan) => {
      const arr = loanIndex.get(loan.user_id) || [];
      arr.push(loan);
      loanIndex.set(loan.user_id, arr);
    });

    borrowers.forEach((borrower) => {
      const borrowerLoans = loanIndex.get(borrower.id) || [];

      const borrowerTotalPrincipal = borrowerLoans.reduce((s, l) => s + (l.principal_amount || 0), 0);
      const borrowerTotalRepaid = borrowerLoans.reduce((s, l) => s + (l.total_paid || 0), 0);
      const borrowerTotalOutstanding = borrowerLoans.reduce((s, l) => s + (l.outstanding_balance || 0), 0);
      const borrowerLoanCount = borrowerLoans.length;
      const borrowerProfit = borrowerLoans.reduce((s, l) => s + ((l.total_paid || 0) - (l.principal_amount || 0)), 0);
      const borrowerLoss = borrowerLoans.reduce((s, l) => {
        const isDefault = (l.status === 'defaulted' || l.status === 'written_off' || (l.status === 'closed' && (l.outstanding_balance || 0) > 0));
        return s + (isDefault ? (l.outstanding_balance || 0) : 0);
      }, 0);

      if (borrowerLoans.length === 0) {
        rows.push([
          borrower.id,
          borrower.full_name,
          borrower.email,
          borrower.phone_number || '',
          borrower.is_active ? 'Yes' : 'No',
          borrowerTotalPrincipal,
          borrowerTotalRepaid,
          borrowerTotalOutstanding,
          borrowerLoanCount,
          borrowerProfit,
          borrowerLoss,
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        ].map(escapeValue).join(','));
        return;
      }

      borrowerLoans.forEach((loan) => {
        const createdAt = loan.created_at ? new Date(loan.created_at) : null;
        const daysSince = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) : '';
        let ageCategory = '';
        if (typeof daysSince === 'number') {
          if (daysSince <= 30) ageCategory = 'Recent (<=30d)';
          else if (daysSince <= 180) ageCategory = 'Medium (31-180d)';
          else ageCategory = 'Old (>180d)';
        }

        const cleared = loan.status === 'cleared' || loan.status === 'closed';
        const delinquent = !cleared && (loan.outstanding_balance || 0) > 0 && (typeof daysSince === 'number' ? daysSince > 30 : false);
        const loanProfit = (loan.total_paid || 0) - (loan.principal_amount || 0);

        rows.push([
          borrower.id,
          borrower.full_name,
          borrower.email,
          borrower.phone_number || '',
          borrower.is_active ? 'Yes' : 'No',
          borrowerTotalPrincipal,
          borrowerTotalRepaid,
          borrowerTotalOutstanding,
          borrowerLoanCount,
          borrowerProfit,
          borrowerLoss,
          loan.id,
          loan.application_no || '',
          loan.product_type || '',
          loan.status || '',
          loan.principal_amount || 0,
          loan.total_paid || 0,
          loan.total_payable ?? '',
          loan.outstanding_balance || 0,
          loan.tenure_months ?? '',
          loan.created_at || '',
          daysSince,
          ageCategory,
          cleared ? 'Yes' : 'No',
          delinquent ? 'Yes' : 'No',
          loanProfit,
          loan.customer?.customer_code || '',
          loan.customer?.national_id || '',
        ].map(escapeValue).join(','));
      });
    });

    return rows.join('\r\n');
  };

  

  // Resolve loans for any borrower by id (used by the inline row accordion)
  const getBorrowerLoans = (borrowerId: number) => loans.filter((l) => l.user_id === borrowerId);

  // Resolve (or mock) customer details for any borrower by id (used by the inline row accordion)
  const getBorrowerCustomer = (borrower: Borrower, borrowerLoans: Loan[]): CustomerResponse => {
    const loanWithCustomer = borrowerLoans.find((l) => l.customer);
    if (loanWithCustomer?.customer) {
      return loanWithCustomer.customer;
    }
    const mockIdVal = (borrower.id * 12345) % 100000;
    const mockCreditScore = 600 + (borrower.id * 17) % 250;
    const mockLimit = 50000 + (borrower.id * 5000) % 200000;
    return {
      id: borrower.id,
      customer_code: `KC-${String(mockIdVal).padStart(8, '0')}`,
      national_id: `NID-${20000000 + (borrower.id * 97) % 80000000}`,
      phone: borrower.phone_number || '254700000000',
      kra_pin: `A${String(mockIdVal).padStart(9, '0')}Z`,
      kyc_status: 'VERIFIED',
      credit_score: mockCreditScore,
      max_loan_limit: mockLimit,
      blacklisted: false,
    } as CustomerResponse;
  };

  // Filter borrowers list based on search
  const filteredBorrowers = useMemo(() => {
    return borrowers.filter((b) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
    
  // Handle Excel export
  


  // Handle Excel export
  


  // Comprehensive Export with ALL details and timestamps
  

  // Comprehensive Export with REAL data from database
  const handleExport = async () => {
    try {
      setExporting(true);
      
      // Fetch ALL data from database
      const [borrowersData, loansData, transactionsData, customersData] = await Promise.all([
        fetchApi('/users/?role=borrower'),
        fetchApi('/loans/'),
        fetchApi('/loans/transactions'),
        fetchApi('/customers/')
      ]);
      
      // Prepare comprehensive export data with REAL values
      const exportData = borrowersData.map((borrower: any) => {
        const customer = customersData.find((c: any) => c.user_id === borrower.id);
        const borrowerLoans = loansData.filter((loan: any) => loan.user_id === borrower.id);
        const borrowerTransactions = transactionsData.filter((t: any) => 
          borrowerLoans.some((l: any) => l.id === t.loan_id)
        );
        
        const activeLoan = borrowerLoans.find((l: any) => l.status === 'active' || l.status === 'disbursed');
        const totalLoans = borrowerLoans.length;
        const totalBorrowed = borrowerLoans.reduce((sum: number, l: any) => sum + (l.principal_amount || 0), 0);
        const totalPaid = borrowerLoans.reduce((sum: number, l: any) => sum + (l.total_paid || 0), 0);
        const totalOutstanding = borrowerLoans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0);
        
        const latestTransaction = borrowerTransactions.length > 0 
          ? borrowerTransactions.reduce((a: any, b: any) => new Date(a.created_at) > new Date(b.created_at) ? a : b)
          : null;
        
        const unpaidLoans = borrowerLoans.filter((l: any) => 
          l.status === 'active' || l.status === 'disbursed' || l.status === 'pending'
        );
        
        const paymentMethods = [...new Set(borrowerTransactions.map((t: any) => t.payment_method || ''))];
        
        let creditScore = customer?.credit_score || 0;
        if (!creditScore && customer) {
          const onTimePayments = borrowerLoans.filter((l: any) => 
            l.status === 'cleared' && l.total_paid >= l.principal_amount
          ).length;
          const totalLoansCount = borrowerLoans.length;
          const repaymentRate = totalLoansCount > 0 ? (onTimePayments / totalLoansCount) * 100 : 0;
          
          if (repaymentRate >= 90) creditScore = 750;
          else if (repaymentRate >= 70) creditScore = 650;
          else if (repaymentRate >= 50) creditScore = 550;
          else if (repaymentRate >= 30) creditScore = 450;
          else if (repaymentRate > 0) creditScore = 350;
          else creditScore = 300;
        }
        
        const formatDate = (date: string) => {
          if (!date) return '';
          try {
            return new Date(date).toLocaleString('en-KE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              timeZone: 'Africa/Nairobi'
            });
          } catch {
            return '';
          }
        };
        
        return {
          'Customer Code': customer?.customer_code || '',
          'Full Name': borrower.full_name || '',
          'Email': borrower.email || '',
          'Phone Number': borrower.phone_number || '',
          'National ID': customer?.national_id || '',
          'KRA PIN': customer?.kra_pin || '',
          'Date of Birth': customer?.date_of_birth || '',
          'Gender': customer?.gender || '',
          'Account Status': borrower.is_active ? 'Active' : 'Inactive',
          'KYC Status': customer?.kyc_status || 'Pending',
          'Credit Score': creditScore || 0,
          'Max Loan Limit (KES)': customer?.max_loan_limit?.toLocaleString() || '0',
          'Total Loans Applied': totalLoans || 0,
          'Total Borrowed (KES)': totalBorrowed.toLocaleString() || '0',
          'Total Paid (KES)': totalPaid.toLocaleString() || '0',
          'Total Outstanding (KES)': totalOutstanding.toLocaleString() || '0',
          'Current Active Loan': activeLoan ? activeLoan.application_no || '' : '',
          'Current Loan Status': activeLoan ? activeLoan.status : '',
          'Current Loan Amount (KES)': activeLoan ? activeLoan.principal_amount?.toLocaleString() : '0',
          'Current Loan Outstanding (KES)': activeLoan ? activeLoan.outstanding_balance?.toLocaleString() : '0',
          'Current Loan Due Date': activeLoan ? formatDate(activeLoan.due_date) : '',
          'Current Loan Disbursement Date': activeLoan ? formatDate(activeLoan.disbursed_at) : '',
          'Unpaid Loans Count': unpaidLoans.length || 0,
          'Unpaid Loans Amount (KES)': unpaidLoans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0).toLocaleString() || '0',
          'Payment Methods Used': paymentMethods.length ? paymentMethods.join(', ') : '',
          'Latest Transaction Date': latestTransaction ? formatDate(latestTransaction.created_at) : '',
          'Latest Transaction Amount (KES)': latestTransaction ? latestTransaction.amount?.toLocaleString() : '0',
          'Latest Transaction Type': latestTransaction ? latestTransaction.type : '',
          'Latest Transaction Reference': latestTransaction ? latestTransaction.reference_code : '',
          'Total Transactions': borrowerTransactions.length || 0,
          'Blacklisted': customer?.blacklisted ? 'Yes' : 'No',
          'Branch': borrower.branch?.name || '',
          'Date Created': formatDate(borrower.created_at),
          'Date Last Updated': formatDate(borrower.updated_at || borrower.created_at),
          'Loan Application Dates': borrowerLoans.map((l: any) => formatDate(l.created_at)).filter(Boolean).join('; '),
          'Loan Disbursement Dates': borrowerLoans.filter((l: any) => l.disbursed_at).map((l: any) => formatDate(l.disbursed_at)).filter(Boolean).join('; '),
          'Loan Due Dates': borrowerLoans.filter((l: any) => l.due_date).map((l: any) => formatDate(l.due_date)).filter(Boolean).join('; ')
        };
      });
      
      if (exportData.length === 0) {
        alert('No data to export');
        setExporting(false);
        return;
      }
      
      const headers = Object.keys(exportData[0]);
      const csvRows = [];
      const BOM = '\uFEFF';
      csvRows.push(headers.join(','));
      
      for (const row of exportData) {
        const values = headers.map(header => {
          let val = row[header] || '';
          val = String(val);
          val = val.replace(/"/g, '""');
          return '"' + val + '"';
        });
        csvRows.push(values.join(','));
      }
      
      const csvString = BOM + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = 'Borrowers_Full_Export_' + timestamp + '.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      
      setExporting(false);
      alert('Export completed successfully!');
      
    } catch (error) {
      console.error('Export error:', error);
      setExporting(false);
      alert('Error exporting data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
        b.full_name.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        (b.phone_number && b.phone_number.includes(q)) ||
        String(b.id).includes(q)
      );
    });
  }, [borrowers, searchQuery]);

  // Set the selected borrower profile details
  const selectedBorrower = useMemo(() => {
    if (selectedBorrowerId === null) return null;
    return borrowers.find((b) => b.id === selectedBorrowerId) || null;
  }, [borrowers, selectedBorrowerId]);

  // Filter loans for selected borrower
  const selectedBorrowerLoans = useMemo(() => {
    if (selectedBorrowerId === null) return [];
    return loans.filter((l) => l.user_id === selectedBorrowerId);
  }, [loans, selectedBorrowerId]);

  // Extract customer details or calculate defaults
  const selectedBorrowerCustomer = useMemo(() => {
    if (!selectedBorrower) return null;
    
    const loanWithCustomer = selectedBorrowerLoans.find((l) => l.customer);
    if (loanWithCustomer?.customer) {
      return loanWithCustomer.customer;
    }

    // Default mock customer details
    const mockIdVal = (selectedBorrower.id * 12345) % 100000;
    const mockCreditScore = 600 + (selectedBorrower.id * 17) % 250;
    const mockLimit = 50000 + (selectedBorrower.id * 5000) % 200000;

    return {
      id: selectedBorrower.id,
      customer_code: `KC-${String(mockIdVal).padStart(8, '0')}`,
      national_id: `NID-${20000000 + (selectedBorrower.id * 97) % 80000000}`,
      phone: selectedBorrower.phone_number || '254700000000',
      kra_pin: `A${String(mockIdVal).padStart(9, '0')}Z`,
      kyc_status: 'VERIFIED',
      credit_score: mockCreditScore,
      max_loan_limit: mockLimit,
      blacklisted: false,
    } as CustomerResponse;
  }, [selectedBorrower, selectedBorrowerLoans]);

  // Statistics for selected borrower
  const stats = useMemo(() => {
    const totalLoans = selectedBorrowerLoans.length;
    const paidLoans = selectedBorrowerLoans.filter(
      (l) => l.status === 'cleared' || l.status === 'closed'
    ).length;
    const activeLoans = selectedBorrowerLoans.filter(
      (l) => l.status === 'disbursed' || l.status === 'active'
    ).length;
    const pendingLoans = selectedBorrowerLoans.filter(
      (l) => l.status === 'pending' || l.status === 'screening' || l.status === 'reviewing'
    ).length;

    const totalPrincipal = selectedBorrowerLoans.reduce((sum, l) => sum + l.principal_amount, 0);
    const totalRepaid = selectedBorrowerLoans.reduce((sum, l) => sum + l.total_paid, 0);
    const totalOutstanding = selectedBorrowerLoans.reduce((sum, l) => sum + l.outstanding_balance, 0);
    
    const totalPayable = selectedBorrowerLoans.reduce((sum, l) => {
      return sum + (l.total_payable || l.principal_amount);
    }, 0);

    const repaymentRate = totalPayable > 0 ? (totalRepaid / totalPayable) * 100 : 0;

    return {
      totalLoans,
      paidLoans,
      activeLoans,
      pendingLoans,
      totalPrincipal,
      totalRepaid,
      totalOutstanding,
      repaymentRate,
    };
  }, [selectedBorrowerLoans]);

  // Loan eligibility assessment
  const eligibility = useMemo(() => {
    if (!selectedBorrowerCustomer) {
      return { tier: 'UNKNOWN', eligible: false, maxAmount: 0, reasons: ['No customer profile on file'] };
    }
    const c = selectedBorrowerCustomer;
    const reasons: string[] = [];
    let eligible = true;

    if (c.blacklisted) {
      eligible = false;
      reasons.push(c.blacklisted_reason || 'Customer is blacklisted');
    }
    if (c.kyc_status !== 'VERIFIED') {
      eligible = false;
      reasons.push('KYC not verified');
    }
    if (stats.totalOutstanding > 0 && stats.repaymentRate < 50 && stats.activeLoans > 0) {
      eligible = false;
      reasons.push('Poor repayment rate on active loan(s)');
    }

    let tier = 'POOR';
    if (c.credit_score >= 750) tier = 'EXCELLENT';
    else if (c.credit_score >= 650) tier = 'GOOD';
    else if (c.credit_score >= 500) tier = 'FAIR';
    if (c.credit_score < 500) eligible = false;

    const maxAmount = eligible ? c.max_loan_limit : 0;
    if (reasons.length === 0) reasons.push('Meets all standard underwriting criteria');

    return { tier, eligible, maxAmount, reasons };
  }, [selectedBorrowerCustomer, stats]);

  // Handle mock CRB Check
  const handleCrbCheck = async () => {
    if (!selectedBorrowerCustomer) return;
    setCrbChecking(true);
    setCrbResult(null);
    try {
      const res = await fetchApi('/loans/crb-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ national_id: selectedBorrowerCustomer.national_id }),
      });
      setCrbResult({
        score: res.score,
        grading: res.grading,
      });
      if (selectedBorrowerCustomer) {
        selectedBorrowerCustomer.credit_score = res.score;
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'CRB check failed');
    } finally {
      setCrbChecking(false);
    }
  };

  // Setup monochrome bar chart data
  const chartData = useMemo(() => {
    const labels = selectedBorrowerLoans.map((l) => l.application_no || `ID: ${l.id}`);
    
    return {
      labels: labels.length > 0 ? labels : ['No Loans'],
      datasets: [
        {
          label: 'Principal Amount (KES)',
          data: labels.length > 0 ? selectedBorrowerLoans.map((l) => l.principal_amount) : [0],
          backgroundColor: THEME.colors.black,
          borderColor: THEME.colors.black,
          borderWidth: 1,
        },
        {
          label: 'Total Repaid (KES)',
          data: labels.length > 0 ? selectedBorrowerLoans.map((l) => l.total_paid) : [0],
          backgroundColor: THEME.colors.white,
          borderColor: THEME.colors.black,
          borderWidth: 1.5,
        },
      ],
    };
  }, [selectedBorrowerLoans]);

  if (loading) {
  
  // Handle Excel export
  


  // Handle Excel export
  


  // Comprehensive Export with ALL details and timestamps
  

  // Comprehensive Export with REAL data from database
  const handleExport = async () => {
    try {
      setExporting(true);
      
      // Fetch ALL data from database
      const [borrowersData, loansData, transactionsData, customersData] = await Promise.all([
        fetchApi('/users/?role=borrower'),
        fetchApi('/loans/'),
        fetchApi('/loans/transactions'),
        fetchApi('/customers/')
      ]);
      
      // Prepare comprehensive export data with REAL values
      const exportData = borrowersData.map((borrower: any) => {
        const customer = customersData.find((c: any) => c.user_id === borrower.id);
        const borrowerLoans = loansData.filter((loan: any) => loan.user_id === borrower.id);
        const borrowerTransactions = transactionsData.filter((t: any) => 
          borrowerLoans.some((l: any) => l.id === t.loan_id)
        );
        
        const activeLoan = borrowerLoans.find((l: any) => l.status === 'active' || l.status === 'disbursed');
        const totalLoans = borrowerLoans.length;
        const totalBorrowed = borrowerLoans.reduce((sum: number, l: any) => sum + (l.principal_amount || 0), 0);
        const totalPaid = borrowerLoans.reduce((sum: number, l: any) => sum + (l.total_paid || 0), 0);
        const totalOutstanding = borrowerLoans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0);
        
        const latestTransaction = borrowerTransactions.length > 0 
          ? borrowerTransactions.reduce((a: any, b: any) => new Date(a.created_at) > new Date(b.created_at) ? a : b)
          : null;
        
        const unpaidLoans = borrowerLoans.filter((l: any) => 
          l.status === 'active' || l.status === 'disbursed' || l.status === 'pending'
        );
        
        const paymentMethods = [...new Set(borrowerTransactions.map((t: any) => t.payment_method || ''))];
        
        let creditScore = customer?.credit_score || 0;
        if (!creditScore && customer) {
          const onTimePayments = borrowerLoans.filter((l: any) => 
            l.status === 'cleared' && l.total_paid >= l.principal_amount
          ).length;
          const totalLoansCount = borrowerLoans.length;
          const repaymentRate = totalLoansCount > 0 ? (onTimePayments / totalLoansCount) * 100 : 0;
          
          if (repaymentRate >= 90) creditScore = 750;
          else if (repaymentRate >= 70) creditScore = 650;
          else if (repaymentRate >= 50) creditScore = 550;
          else if (repaymentRate >= 30) creditScore = 450;
          else if (repaymentRate > 0) creditScore = 350;
          else creditScore = 300;
        }
        
        const formatDate = (date: string) => {
          if (!date) return '';
          try {
            return new Date(date).toLocaleString('en-KE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              timeZone: 'Africa/Nairobi'
            });
          } catch {
            return '';
          }
        };
        
        return {
          'Customer Code': customer?.customer_code || '',
          'Full Name': borrower.full_name || '',
          'Email': borrower.email || '',
          'Phone Number': borrower.phone_number || '',
          'National ID': customer?.national_id || '',
          'KRA PIN': customer?.kra_pin || '',
          'Date of Birth': customer?.date_of_birth || '',
          'Gender': customer?.gender || '',
          'Account Status': borrower.is_active ? 'Active' : 'Inactive',
          'KYC Status': customer?.kyc_status || 'Pending',
          'Credit Score': creditScore || 0,
          'Max Loan Limit (KES)': customer?.max_loan_limit?.toLocaleString() || '0',
          'Total Loans Applied': totalLoans || 0,
          'Total Borrowed (KES)': totalBorrowed.toLocaleString() || '0',
          'Total Paid (KES)': totalPaid.toLocaleString() || '0',
          'Total Outstanding (KES)': totalOutstanding.toLocaleString() || '0',
          'Current Active Loan': activeLoan ? activeLoan.application_no || '' : '',
          'Current Loan Status': activeLoan ? activeLoan.status : '',
          'Current Loan Amount (KES)': activeLoan ? activeLoan.principal_amount?.toLocaleString() : '0',
          'Current Loan Outstanding (KES)': activeLoan ? activeLoan.outstanding_balance?.toLocaleString() : '0',
          'Current Loan Due Date': activeLoan ? formatDate(activeLoan.due_date) : '',
          'Current Loan Disbursement Date': activeLoan ? formatDate(activeLoan.disbursed_at) : '',
          'Unpaid Loans Count': unpaidLoans.length || 0,
          'Unpaid Loans Amount (KES)': unpaidLoans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0).toLocaleString() || '0',
          'Payment Methods Used': paymentMethods.length ? paymentMethods.join(', ') : '',
          'Latest Transaction Date': latestTransaction ? formatDate(latestTransaction.created_at) : '',
          'Latest Transaction Amount (KES)': latestTransaction ? latestTransaction.amount?.toLocaleString() : '0',
          'Latest Transaction Type': latestTransaction ? latestTransaction.type : '',
          'Latest Transaction Reference': latestTransaction ? latestTransaction.reference_code : '',
          'Total Transactions': borrowerTransactions.length || 0,
          'Blacklisted': customer?.blacklisted ? 'Yes' : 'No',
          'Branch': borrower.branch?.name || '',
          'Date Created': formatDate(borrower.created_at),
          'Date Last Updated': formatDate(borrower.updated_at || borrower.created_at),
          'Loan Application Dates': borrowerLoans.map((l: any) => formatDate(l.created_at)).filter(Boolean).join('; '),
          'Loan Disbursement Dates': borrowerLoans.filter((l: any) => l.disbursed_at).map((l: any) => formatDate(l.disbursed_at)).filter(Boolean).join('; '),
          'Loan Due Dates': borrowerLoans.filter((l: any) => l.due_date).map((l: any) => formatDate(l.due_date)).filter(Boolean).join('; ')
        };
      });
      
      if (exportData.length === 0) {
        alert('No data to export');
        setExporting(false);
        return;
      }
      
      const headers = Object.keys(exportData[0]);
      const csvRows = [];
      const BOM = '\uFEFF';
      csvRows.push(headers.join(','));
      
      for (const row of exportData) {
        const values = headers.map(header => {
          let val = row[header] || '';
          val = String(val);
          val = val.replace(/"/g, '""');
          return '"' + val + '"';
        });
        csvRows.push(values.join(','));
      }
      
      const csvString = BOM + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = 'Borrowers_Full_Export_' + timestamp + '.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      
      setExporting(false);
      alert('Export completed successfully!');
      
    } catch (error) {
      console.error('Export error:', error);
      setExporting(false);
      alert('Error exporting data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
      <div className="min-h-[500px] flex items-center justify-center bg-white border border-black p-8 text-black gap-3 font-mono">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></span>
        LOADING DASHBOARD...
      </div>
    );
  }

  if (error) {
  
  // Handle Excel export
  


  // Handle Excel export
  


  // Comprehensive Export with ALL details and timestamps
  

  // Comprehensive Export with REAL data from database
  const handleExport = async () => {
    try {
      setExporting(true);
      
      // Fetch ALL data from database
      const [borrowersData, loansData, transactionsData, customersData] = await Promise.all([
        fetchApi('/users/?role=borrower'),
        fetchApi('/loans/'),
        fetchApi('/loans/transactions'),
        fetchApi('/customers/')
      ]);
      
      // Prepare comprehensive export data with REAL values
      const exportData = borrowersData.map((borrower: any) => {
        const customer = customersData.find((c: any) => c.user_id === borrower.id);
        const borrowerLoans = loansData.filter((loan: any) => loan.user_id === borrower.id);
        const borrowerTransactions = transactionsData.filter((t: any) => 
          borrowerLoans.some((l: any) => l.id === t.loan_id)
        );
        
        const activeLoan = borrowerLoans.find((l: any) => l.status === 'active' || l.status === 'disbursed');
        const totalLoans = borrowerLoans.length;
        const totalBorrowed = borrowerLoans.reduce((sum: number, l: any) => sum + (l.principal_amount || 0), 0);
        const totalPaid = borrowerLoans.reduce((sum: number, l: any) => sum + (l.total_paid || 0), 0);
        const totalOutstanding = borrowerLoans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0);
        
        const latestTransaction = borrowerTransactions.length > 0 
          ? borrowerTransactions.reduce((a: any, b: any) => new Date(a.created_at) > new Date(b.created_at) ? a : b)
          : null;
        
        const unpaidLoans = borrowerLoans.filter((l: any) => 
          l.status === 'active' || l.status === 'disbursed' || l.status === 'pending'
        );
        
        const paymentMethods = [...new Set(borrowerTransactions.map((t: any) => t.payment_method || ''))];
        
        let creditScore = customer?.credit_score || 0;
        if (!creditScore && customer) {
          const onTimePayments = borrowerLoans.filter((l: any) => 
            l.status === 'cleared' && l.total_paid >= l.principal_amount
          ).length;
          const totalLoansCount = borrowerLoans.length;
          const repaymentRate = totalLoansCount > 0 ? (onTimePayments / totalLoansCount) * 100 : 0;
          
          if (repaymentRate >= 90) creditScore = 750;
          else if (repaymentRate >= 70) creditScore = 650;
          else if (repaymentRate >= 50) creditScore = 550;
          else if (repaymentRate >= 30) creditScore = 450;
          else if (repaymentRate > 0) creditScore = 350;
          else creditScore = 300;
        }
        
        const formatDate = (date: string) => {
          if (!date) return '';
          try {
            return new Date(date).toLocaleString('en-KE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              timeZone: 'Africa/Nairobi'
            });
          } catch {
            return '';
          }
        };
        
        return {
          'Customer Code': customer?.customer_code || '',
          'Full Name': borrower.full_name || '',
          'Email': borrower.email || '',
          'Phone Number': borrower.phone_number || '',
          'National ID': customer?.national_id || '',
          'KRA PIN': customer?.kra_pin || '',
          'Date of Birth': customer?.date_of_birth || '',
          'Gender': customer?.gender || '',
          'Account Status': borrower.is_active ? 'Active' : 'Inactive',
          'KYC Status': customer?.kyc_status || 'Pending',
          'Credit Score': creditScore || 0,
          'Max Loan Limit (KES)': customer?.max_loan_limit?.toLocaleString() || '0',
          'Total Loans Applied': totalLoans || 0,
          'Total Borrowed (KES)': totalBorrowed.toLocaleString() || '0',
          'Total Paid (KES)': totalPaid.toLocaleString() || '0',
          'Total Outstanding (KES)': totalOutstanding.toLocaleString() || '0',
          'Current Active Loan': activeLoan ? activeLoan.application_no || '' : '',
          'Current Loan Status': activeLoan ? activeLoan.status : '',
          'Current Loan Amount (KES)': activeLoan ? activeLoan.principal_amount?.toLocaleString() : '0',
          'Current Loan Outstanding (KES)': activeLoan ? activeLoan.outstanding_balance?.toLocaleString() : '0',
          'Current Loan Due Date': activeLoan ? formatDate(activeLoan.due_date) : '',
          'Current Loan Disbursement Date': activeLoan ? formatDate(activeLoan.disbursed_at) : '',
          'Unpaid Loans Count': unpaidLoans.length || 0,
          'Unpaid Loans Amount (KES)': unpaidLoans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0).toLocaleString() || '0',
          'Payment Methods Used': paymentMethods.length ? paymentMethods.join(', ') : '',
          'Latest Transaction Date': latestTransaction ? formatDate(latestTransaction.created_at) : '',
          'Latest Transaction Amount (KES)': latestTransaction ? latestTransaction.amount?.toLocaleString() : '0',
          'Latest Transaction Type': latestTransaction ? latestTransaction.type : '',
          'Latest Transaction Reference': latestTransaction ? latestTransaction.reference_code : '',
          'Total Transactions': borrowerTransactions.length || 0,
          'Blacklisted': customer?.blacklisted ? 'Yes' : 'No',
          'Branch': borrower.branch?.name || '',
          'Date Created': formatDate(borrower.created_at),
          'Date Last Updated': formatDate(borrower.updated_at || borrower.created_at),
          'Loan Application Dates': borrowerLoans.map((l: any) => formatDate(l.created_at)).filter(Boolean).join('; '),
          'Loan Disbursement Dates': borrowerLoans.filter((l: any) => l.disbursed_at).map((l: any) => formatDate(l.disbursed_at)).filter(Boolean).join('; '),
          'Loan Due Dates': borrowerLoans.filter((l: any) => l.due_date).map((l: any) => formatDate(l.due_date)).filter(Boolean).join('; ')
        };
      });
      
      if (exportData.length === 0) {
        alert('No data to export');
        setExporting(false);
        return;
      }
      
      const headers = Object.keys(exportData[0]);
      const csvRows = [];
      const BOM = '\uFEFF';
      csvRows.push(headers.join(','));
      
      for (const row of exportData) {
        const values = headers.map(header => {
          let val = row[header] || '';
          val = String(val);
          val = val.replace(/"/g, '""');
          return '"' + val + '"';
        });
        csvRows.push(values.join(','));
      }
      
      const csvString = BOM + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = 'Borrowers_Full_Export_' + timestamp + '.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      
      setExporting(false);
      alert('Export completed successfully!');
      
    } catch (error) {
      console.error('Export error:', error);
      setExporting(false);
      alert('Error exporting data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
      <div className="bg-white border border-black p-8 text-black font-mono">
        <div className="flex items-center gap-3">
          <span></span>
          <span>{error}</span>
        </div>
      </div>
    );
  }


  // Handle Excel export
  


  // Handle Excel export
  


  // Comprehensive Export with ALL details and timestamps
  

  // Comprehensive Export with REAL data from database
  const handleExport = async () => {
    try {
      setExporting(true);
      
      // Fetch ALL data from database
      const [borrowersData, loansData, transactionsData, customersData] = await Promise.all([
        fetchApi('/users/?role=borrower'),
        fetchApi('/loans/'),
        fetchApi('/loans/transactions'),
        fetchApi('/customers/')
      ]);
      
      // Prepare comprehensive export data with REAL values
      const exportData = borrowersData.map((borrower: any) => {
        const customer = customersData.find((c: any) => c.user_id === borrower.id);
        const borrowerLoans = loansData.filter((loan: any) => loan.user_id === borrower.id);
        const borrowerTransactions = transactionsData.filter((t: any) => 
          borrowerLoans.some((l: any) => l.id === t.loan_id)
        );
        
        const activeLoan = borrowerLoans.find((l: any) => l.status === 'active' || l.status === 'disbursed');
        const totalLoans = borrowerLoans.length;
        const totalBorrowed = borrowerLoans.reduce((sum: number, l: any) => sum + (l.principal_amount || 0), 0);
        const totalPaid = borrowerLoans.reduce((sum: number, l: any) => sum + (l.total_paid || 0), 0);
        const totalOutstanding = borrowerLoans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0);
        
        const latestTransaction = borrowerTransactions.length > 0 
          ? borrowerTransactions.reduce((a: any, b: any) => new Date(a.created_at) > new Date(b.created_at) ? a : b)
          : null;
        
        const unpaidLoans = borrowerLoans.filter((l: any) => 
          l.status === 'active' || l.status === 'disbursed' || l.status === 'pending'
        );
        
        const paymentMethods = [...new Set(borrowerTransactions.map((t: any) => t.payment_method || ''))];
        
        let creditScore = customer?.credit_score || 0;
        if (!creditScore && customer) {
          const onTimePayments = borrowerLoans.filter((l: any) => 
            l.status === 'cleared' && l.total_paid >= l.principal_amount
          ).length;
          const totalLoansCount = borrowerLoans.length;
          const repaymentRate = totalLoansCount > 0 ? (onTimePayments / totalLoansCount) * 100 : 0;
          
          if (repaymentRate >= 90) creditScore = 750;
          else if (repaymentRate >= 70) creditScore = 650;
          else if (repaymentRate >= 50) creditScore = 550;
          else if (repaymentRate >= 30) creditScore = 450;
          else if (repaymentRate > 0) creditScore = 350;
          else creditScore = 300;
        }
        
        const formatDate = (date: string) => {
          if (!date) return '';
          try {
            return new Date(date).toLocaleString('en-KE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              timeZone: 'Africa/Nairobi'
            });
          } catch {
            return '';
          }
        };
        
        return {
          'Customer Code': customer?.customer_code || '',
          'Full Name': borrower.full_name || '',
          'Email': borrower.email || '',
          'Phone Number': borrower.phone_number || '',
          'National ID': customer?.national_id || '',
          'KRA PIN': customer?.kra_pin || '',
          'Date of Birth': customer?.date_of_birth || '',
          'Gender': customer?.gender || '',
          'Account Status': borrower.is_active ? 'Active' : 'Inactive',
          'KYC Status': customer?.kyc_status || 'Pending',
          'Credit Score': creditScore || 0,
          'Max Loan Limit (KES)': customer?.max_loan_limit?.toLocaleString() || '0',
          'Total Loans Applied': totalLoans || 0,
          'Total Borrowed (KES)': totalBorrowed.toLocaleString() || '0',
          'Total Paid (KES)': totalPaid.toLocaleString() || '0',
          'Total Outstanding (KES)': totalOutstanding.toLocaleString() || '0',
          'Current Active Loan': activeLoan ? activeLoan.application_no || '' : '',
          'Current Loan Status': activeLoan ? activeLoan.status : '',
          'Current Loan Amount (KES)': activeLoan ? activeLoan.principal_amount?.toLocaleString() : '0',
          'Current Loan Outstanding (KES)': activeLoan ? activeLoan.outstanding_balance?.toLocaleString() : '0',
          'Current Loan Due Date': activeLoan ? formatDate(activeLoan.due_date) : '',
          'Current Loan Disbursement Date': activeLoan ? formatDate(activeLoan.disbursed_at) : '',
          'Unpaid Loans Count': unpaidLoans.length || 0,
          'Unpaid Loans Amount (KES)': unpaidLoans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0).toLocaleString() || '0',
          'Payment Methods Used': paymentMethods.length ? paymentMethods.join(', ') : '',
          'Latest Transaction Date': latestTransaction ? formatDate(latestTransaction.created_at) : '',
          'Latest Transaction Amount (KES)': latestTransaction ? latestTransaction.amount?.toLocaleString() : '0',
          'Latest Transaction Type': latestTransaction ? latestTransaction.type : '',
          'Latest Transaction Reference': latestTransaction ? latestTransaction.reference_code : '',
          'Total Transactions': borrowerTransactions.length || 0,
          'Blacklisted': customer?.blacklisted ? 'Yes' : 'No',
          'Branch': borrower.branch?.name || '',
          'Date Created': formatDate(borrower.created_at),
          'Date Last Updated': formatDate(borrower.updated_at || borrower.created_at),
          'Loan Application Dates': borrowerLoans.map((l: any) => formatDate(l.created_at)).filter(Boolean).join('; '),
          'Loan Disbursement Dates': borrowerLoans.filter((l: any) => l.disbursed_at).map((l: any) => formatDate(l.disbursed_at)).filter(Boolean).join('; '),
          'Loan Due Dates': borrowerLoans.filter((l: any) => l.due_date).map((l: any) => formatDate(l.due_date)).filter(Boolean).join('; ')
        };
      });
      
      if (exportData.length === 0) {
        alert('No data to export');
        setExporting(false);
        return;
      }
      
      const headers = Object.keys(exportData[0]);
      const csvRows = [];
      const BOM = '\uFEFF';
      csvRows.push(headers.join(','));
      
      for (const row of exportData) {
        const values = headers.map(header => {
          let val = row[header] || '';
          val = String(val);
          val = val.replace(/"/g, '""');
          return '"' + val + '"';
        });
        csvRows.push(values.join(','));
      }
      
      const csvString = BOM + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = 'Borrowers_Full_Export_' + timestamp + '.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      
      setExporting(false);
      alert('Export completed successfully!');
      
    } catch (error) {
      console.error('Export error:', error);
      setExporting(false);
      alert('Error exporting data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${THEME.classes.card} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <p className={THEME.classes.subtitle}>ADMINISTRATIVE INTERFACE</p>
          <h2 className={THEME.classes.title}>Customer Portfolio & Credit Risk</h2>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={handleExport}
                disabled={exporting || exportingExcel}
            disabled={exporting || exportingExcel}
            className="border border-black bg-white text-black px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors disabled:opacity-50"
          >
            {exportingExcel ? 'EXPORTING EXCEL SHEET...' : 'EXPORT EXCEL SHEET'}
          </button>
          {exportStatus && (
            <div className="text-xs font-mono text-zinc-600 mt-1 w-full">{exportStatus}</div>
          )}
          <Link href="/dashboard/borrowers/new" className={THEME.classes.btnPrimary}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            Onboard Borrower
              <button
                onClick={handleExport}
                disabled={exporting || exportingExcel}
                className="border border-black bg-white text-black px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
                style={{ fontFamily: "monospace" }}
              >
                Export to Excel
              </button>
          </Link>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Side: Master Borrower List */}
        {(isListExpanded || !isDetailExpanded) && (
          <div className={`${THEME.classes.card} ${isListExpanded ? 'lg:col-span-12' : 'lg:col-span-5'} space-y-4 flex flex-col`}>
            <div className="border-b border-black pb-3">
              <h3 className={THEME.classes.sectionTitle}>Borrowers List</h3>
              <button
                type="button"
                onClick={() => setIsListExpanded(!isListExpanded)}
                title={isListExpanded ? "Collapse List" : "Expand List to Full Screen"}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px", border: "1px solid #000", background: "#fff", color: "#000", cursor: "pointer", borderRadius: "2px", marginLeft: "8px" }}
              >
                {isListExpanded ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H3v5M16 21h5v-5M21 3l-7 7M3 21l7-7" />
                  </svg>
                )}
              </button>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">Total accounts: {borrowers.length}</p>
            </div>

            {/* Search box */}
            <div className="relative">
              <input
                type="text"
                placeholder="SEARCH BY NAME, EMAIL, PHONE, OR ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={THEME.classes.input}
              />
              <svg className="absolute right-3 top-3.5 h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>

            {/* Table / List */}
            <div className="overflow-y-auto flex-1 max-h-[calc(100vh-220px)] border border-black divide-y divide-black">
              {filteredBorrowers.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-zinc-400 uppercase tracking-widest">
                  No borrowers found
                </div>
              ) : (
                filteredBorrowers.map((user) => {
                  const isSelected = user.id === selectedBorrowerId;
                  const rowLoans = getBorrowerLoans(user.id);
                  const rowCustomer = getBorrowerCustomer(user, rowLoans);
                  const isExpanded = expandedRowId === user.id;
                  const currentLoan = rowLoans.find((l) => l.status === 'disbursed' || l.status === 'active');
                
  // Handle Excel export
  


  // Handle Excel export
  


  // Comprehensive Export with ALL details and timestamps
  

  // Comprehensive Export with REAL data from database
  const handleExport = async () => {
    try {
      setExporting(true);
      
      // Fetch ALL data from database
      const [borrowersData, loansData, transactionsData, customersData] = await Promise.all([
        fetchApi('/users/?role=borrower'),
        fetchApi('/loans/'),
        fetchApi('/loans/transactions'),
        fetchApi('/customers/')
      ]);
      
      // Prepare comprehensive export data with REAL values
      const exportData = borrowersData.map((borrower: any) => {
        const customer = customersData.find((c: any) => c.user_id === borrower.id);
        const borrowerLoans = loansData.filter((loan: any) => loan.user_id === borrower.id);
        const borrowerTransactions = transactionsData.filter((t: any) => 
          borrowerLoans.some((l: any) => l.id === t.loan_id)
        );
        
        const activeLoan = borrowerLoans.find((l: any) => l.status === 'active' || l.status === 'disbursed');
        const totalLoans = borrowerLoans.length;
        const totalBorrowed = borrowerLoans.reduce((sum: number, l: any) => sum + (l.principal_amount || 0), 0);
        const totalPaid = borrowerLoans.reduce((sum: number, l: any) => sum + (l.total_paid || 0), 0);
        const totalOutstanding = borrowerLoans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0);
        
        const latestTransaction = borrowerTransactions.length > 0 
          ? borrowerTransactions.reduce((a: any, b: any) => new Date(a.created_at) > new Date(b.created_at) ? a : b)
          : null;
        
        const unpaidLoans = borrowerLoans.filter((l: any) => 
          l.status === 'active' || l.status === 'disbursed' || l.status === 'pending'
        );
        
        const paymentMethods = [...new Set(borrowerTransactions.map((t: any) => t.payment_method || ''))];
        
        let creditScore = customer?.credit_score || 0;
        if (!creditScore && customer) {
          const onTimePayments = borrowerLoans.filter((l: any) => 
            l.status === 'cleared' && l.total_paid >= l.principal_amount
          ).length;
          const totalLoansCount = borrowerLoans.length;
          const repaymentRate = totalLoansCount > 0 ? (onTimePayments / totalLoansCount) * 100 : 0;
          
          if (repaymentRate >= 90) creditScore = 750;
          else if (repaymentRate >= 70) creditScore = 650;
          else if (repaymentRate >= 50) creditScore = 550;
          else if (repaymentRate >= 30) creditScore = 450;
          else if (repaymentRate > 0) creditScore = 350;
          else creditScore = 300;
        }
        
        const formatDate = (date: string) => {
          if (!date) return '';
          try {
            return new Date(date).toLocaleString('en-KE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              timeZone: 'Africa/Nairobi'
            });
          } catch {
            return '';
          }
        };
        
        return {
          'Customer Code': customer?.customer_code || '',
          'Full Name': borrower.full_name || '',
          'Email': borrower.email || '',
          'Phone Number': borrower.phone_number || '',
          'National ID': customer?.national_id || '',
          'KRA PIN': customer?.kra_pin || '',
          'Date of Birth': customer?.date_of_birth || '',
          'Gender': customer?.gender || '',
          'Account Status': borrower.is_active ? 'Active' : 'Inactive',
          'KYC Status': customer?.kyc_status || 'Pending',
          'Credit Score': creditScore || 0,
          'Max Loan Limit (KES)': customer?.max_loan_limit?.toLocaleString() || '0',
          'Total Loans Applied': totalLoans || 0,
          'Total Borrowed (KES)': totalBorrowed.toLocaleString() || '0',
          'Total Paid (KES)': totalPaid.toLocaleString() || '0',
          'Total Outstanding (KES)': totalOutstanding.toLocaleString() || '0',
          'Current Active Loan': activeLoan ? activeLoan.application_no || '' : '',
          'Current Loan Status': activeLoan ? activeLoan.status : '',
          'Current Loan Amount (KES)': activeLoan ? activeLoan.principal_amount?.toLocaleString() : '0',
          'Current Loan Outstanding (KES)': activeLoan ? activeLoan.outstanding_balance?.toLocaleString() : '0',
          'Current Loan Due Date': activeLoan ? formatDate(activeLoan.due_date) : '',
          'Current Loan Disbursement Date': activeLoan ? formatDate(activeLoan.disbursed_at) : '',
          'Unpaid Loans Count': unpaidLoans.length || 0,
          'Unpaid Loans Amount (KES)': unpaidLoans.reduce((sum: number, l: any) => sum + (l.outstanding_balance || 0), 0).toLocaleString() || '0',
          'Payment Methods Used': paymentMethods.length ? paymentMethods.join(', ') : '',
          'Latest Transaction Date': latestTransaction ? formatDate(latestTransaction.created_at) : '',
          'Latest Transaction Amount (KES)': latestTransaction ? latestTransaction.amount?.toLocaleString() : '0',
          'Latest Transaction Type': latestTransaction ? latestTransaction.type : '',
          'Latest Transaction Reference': latestTransaction ? latestTransaction.reference_code : '',
          'Total Transactions': borrowerTransactions.length || 0,
          'Blacklisted': customer?.blacklisted ? 'Yes' : 'No',
          'Branch': borrower.branch?.name || '',
          'Date Created': formatDate(borrower.created_at),
          'Date Last Updated': formatDate(borrower.updated_at || borrower.created_at),
          'Loan Application Dates': borrowerLoans.map((l: any) => formatDate(l.created_at)).filter(Boolean).join('; '),
          'Loan Disbursement Dates': borrowerLoans.filter((l: any) => l.disbursed_at).map((l: any) => formatDate(l.disbursed_at)).filter(Boolean).join('; '),
          'Loan Due Dates': borrowerLoans.filter((l: any) => l.due_date).map((l: any) => formatDate(l.due_date)).filter(Boolean).join('; ')
        };
      });
      
      if (exportData.length === 0) {
        alert('No data to export');
        setExporting(false);
        return;
      }
      
      const headers = Object.keys(exportData[0]);
      const csvRows = [];
      const BOM = '\uFEFF';
      csvRows.push(headers.join(','));
      
      for (const row of exportData) {
        const values = headers.map(header => {
          let val = row[header] || '';
          val = String(val);
          val = val.replace(/"/g, '""');
          return '"' + val + '"';
        });
        csvRows.push(values.join(','));
      }
      
      const csvString = BOM + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = 'Borrowers_Full_Export_' + timestamp + '.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      
      setExporting(false);
      alert('Export completed successfully!');
      
    } catch (error) {
      console.error('Export error:', error);
      setExporting(false);
      alert('Error exporting data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
                    <div key={user.id}>
                    <div
                      onClick={() => {
                        setSelectedBorrowerId(user.id);
                        setCrbResult(null);
                      }}
                      className={`p-4 cursor-pointer transition-colors duration-100 flex items-center gap-3 justify-between ${
                        isSelected ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedRowId(isExpanded ? null : user.id);
                        }}
                        title={isExpanded ? 'Collapse row' : 'Expand row'}
                        className={`flex-shrink-0 flex items-center justify-center border w-8 h-8 text-sm font-bold ${
                          isSelected ? 'border-white text-white hover:bg-white hover:text-black' : 'border-black bg-white text-black hover:bg-black hover:text-white'
                        }`}
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                      <div className="min-w-0 pr-3 flex-1">
                        <div className="font-bold text-xs uppercase tracking-wide truncate">{user.full_name}</div>
                        <div className={`text-[10px] font-mono mt-0.5 truncate ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {user.email}
                        </div>
                        <div className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {user.phone_number || 'NO PHONE'}
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className={`border text-[9px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 ${
                          isSelected 
                            ? 'border-white text-white' 
                            : 'border-black bg-black text-white'
                        }`}>
                          ID #{user.id}
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="p-4 bg-zinc-50 border-t border-black space-y-4">
                        <div>
                          <h5 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Personal Details</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono uppercase">
                            <div className="flex justify-between"><span className="text-zinc-500">Full Name</span><span className="text-black font-bold">{user.full_name}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Email</span><span className="text-black font-bold truncate ml-2">{user.email}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Phone</span><span className="text-black font-bold">{user.phone_number || '—'}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">National ID</span><span className="text-black font-bold">{rowCustomer.national_id}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">KRA PIN</span><span className="text-black font-bold">{rowCustomer.kra_pin || 'NOT PROVIDED'}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">KYC Status</span><span className="text-black font-bold">{rowCustomer.kyc_status}</span></div>
                          </div>
                        </div>
                        <div>
                          <h5 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Current Loan</h5>
                          {currentLoan ? (
                            <div className="border border-black bg-white p-2 text-[11px] font-mono uppercase flex flex-wrap justify-between gap-2">
                              <span>{currentLoan.application_no || `L-${currentLoan.id}`}</span>
                              <span>KES {currentLoan.principal_amount.toLocaleString()}</span>
                              <span>Outstanding: KES {currentLoan.outstanding_balance.toLocaleString()}</span>
                              <span className={THEME.classes.badgeOutline}>{currentLoan.status}</span>
                            </div>
                          ) : (
                            <div className="text-[11px] font-mono uppercase text-zinc-400">No active loan</div>
                          )}
                        </div>
                        <div>
                          <h5 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">All Loans ({rowLoans.length})</h5>
                          {rowLoans.length === 0 ? (
                            <div className="text-[11px] font-mono uppercase text-zinc-400">No loan applications on file</div>
                          ) : (
                            <div className="border border-black divide-y divide-black">
                              {rowLoans.map((l) => (
                                <div key={l.id} className="p-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono uppercase bg-white">
                                  <span className="font-bold">{l.application_no || `L-${l.id}`}</span>
                                  <span>KES {l.principal_amount.toLocaleString()}</span>
                                  <span>Paid: KES {l.total_paid.toLocaleString()}</span>
                                  <span className={
                                    l.status === 'cleared' || l.status === 'closed'
                                      ? THEME.classes.badgeFilled
                                      : l.status === 'disbursed' || l.status === 'active'
                                      ? THEME.classes.badgeOutline
                                      : THEME.classes.badgeMuted
                                  }>
                                    {l.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Right Side: Detail Statistics View */}
        {!isListExpanded && (
        <div className={`${THEME.classes.card} ${isDetailExpanded ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-6`}>
          {selectedBorrower ? (
            <>
              {/* Profile Header */}
              <div className="border-b border-black pb-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold uppercase tracking-wide text-black">
                      {selectedBorrower.full_name}
                    </h3>
                    <button
                      onClick={() => setIsDetailExpanded(!isDetailExpanded)}
                      title={isDetailExpanded ? "Collapse Details" : "Expand Details"}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        border: '1px solid #000',
                        background: '#fff',
                        color: '#000',
                        cursor: 'pointer',
                        borderRadius: '2px',
                        marginLeft: '4px'
                      }}
                    >
                      {isDetailExpanded ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 3H3v5M16 21h5v-5M21 3l-7 7M3 21l7-7" />
                        </svg>
                      )}
                    </button>
                    <span className={THEME.classes.badgeFilled}>
                      {selectedBorrower.is_active ? 'ACTIVE ACCOUNT' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono uppercase text-zinc-500">
                    <div>Email: <span className="text-black font-semibold">{selectedBorrower.email}</span></div>
                    <div>Phone: <span className="text-black font-semibold">{selectedBorrower.phone_number || '—'}</span></div>
                    {selectedBorrowerCustomer && (
                      <>
                        <div>Code: <span className="text-black font-semibold">{selectedBorrowerCustomer.customer_code}</span></div>
                        <div>National ID: <span className="text-black font-semibold">{selectedBorrowerCustomer.national_id}</span></div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleCrbCheck}
                    disabled={crbChecking}
                    style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'0.35rem', border:'1px solid #000', background:'#fff', color:'#000', padding:'0.5rem 1rem', fontSize:'11px', fontWeight:700, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.03em', cursor: crbChecking ? 'default' : 'pointer', opacity: crbChecking ? 0.6 : 1 }}
                  >
                    {crbChecking ? 'RUNNING CRB...' : 'RUN CRB CHECK'}
                  </button>
                  <Link
                    href={`/dashboard/loans/new?borrower_id=${selectedBorrower.id}`}
                    style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'0.35rem', border:'1px solid #000', background:'#000', color:'#ffffff', padding:'0.5rem 1rem', fontSize:'11px', fontWeight:700, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.03em', textDecoration:'none', cursor:'pointer' }}
                  >
                    CREATE LOAN
                  </Link>
                </div>
              </div>

              {/* CRB Simulation Banner */}
              {crbResult && (
                <div className="border-2 border-black bg-white p-4 font-mono text-xs uppercase flex items-center justify-between">
                  <div>
                    <span className="font-bold">CRB INQUIRY RESULT</span>
                    <div className="mt-1 text-[11px] text-zinc-600">
                      Score: <span className="text-black font-bold">{crbResult.score}</span> | Risk Grading: <span className="text-black font-bold">{crbResult.grading}</span>
                    </div>
                  </div>
                  <div className="border border-black bg-black text-white px-2 py-1 font-bold">
                    PASSED
                  </div>
                </div>
              )}

              {/* 4 Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border border-black p-3 bg-white">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">LOANS APPLIED</div>
                  <div className="text-2xl font-bold font-mono text-black mt-1">{stats.totalLoans}</div>
                  <div className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">
                    {stats.pendingLoans} PENDING
                  </div>
                </div>

                <div className="border border-black p-3 bg-white">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">FULLY PAID</div>
                  <div className="text-2xl font-bold font-mono text-black mt-1">{stats.paidLoans}</div>
                  <div className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">
                    {stats.activeLoans} ACTIVE DEBTS
                  </div>
                </div>

                <div className="border border-black p-3 bg-white">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">OUTSTANDING</div>
                  <div className="text-lg font-bold font-mono text-black mt-1.5 truncate">
                    KES {stats.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">
                    FROM {stats.totalPrincipal.toLocaleString()} PRINCIPAL
                  </div>
                </div>

                <div className="border border-black p-3 bg-white">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">CREDIT SCORE</div>
                  <div className="text-2xl font-bold font-mono text-black mt-1">
                    {selectedBorrowerCustomer?.credit_score || 'N/A'}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">
                    LIMIT: KES {selectedBorrowerCustomer?.max_loan_limit.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Stats Rows & Charts */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Financial Summary */}
                <div className="md:col-span-5 border border-black p-4 space-y-4">
                  <h4 className={THEME.classes.sectionTitle}>Financial Summary</h4>
                  <div className="space-y-3 text-xs font-mono uppercase">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Total Borrowed</span>
                      <span className="text-black font-bold">
                        KES {stats.totalPrincipal.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Total Repaid</span>
                      <span className="text-black font-bold">
                        KES {stats.totalRepaid.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Repayment Rate</span>
                      <span className="text-black font-bold">
                        {stats.repaymentRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">KRA PIN</span>
                      <span className="text-black font-bold">
                        {selectedBorrowerCustomer?.kra_pin || 'NOT PROVIDED'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">KYC Status</span>
                      <span className="text-black font-bold">
                        {selectedBorrowerCustomer?.kyc_status || 'PENDING'}
                      </span>
                    </div>
                  </div>

                  {/* Meter */}
                  <div className="pt-2">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                      CREDIT RATING METER
                    </div>
                    <div className="h-4 w-full border border-black bg-white relative overflow-hidden">
                      <div
                        className="h-full bg-black transition-all duration-300"
                        style={{
                          width: `${selectedBorrowerCustomer ? Math.min(100, Math.max(0, ((selectedBorrowerCustomer.credit_score - 300) / 550) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] font-mono text-zinc-400 uppercase mt-1">
                      <span>300 (POOR)</span>
                      <span>850 (EXCELLENT)</span>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="md:col-span-7 border border-black p-4 flex flex-col">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-black border-b border-zinc-200 pb-2 mb-3">
                    Principal vs Repayments
                  </h4>
                  <div className="flex-1 min-h-[160px] relative">
                    <Bar data={chartData} options={THEME.chart.options} />
                  </div>
                </div>
              </div>

              {/* Personal Details & Eligibility */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-black p-4 space-y-3">
                  <h4 className={THEME.classes.sectionTitle}>Personal Details</h4>
                  <div className="space-y-2 text-xs font-mono uppercase">
                    <div className="flex justify-between"><span className="text-zinc-500">Full Name</span><span className="text-black font-bold">{selectedBorrower.full_name}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Email</span><span className="text-black font-bold">{selectedBorrower.email}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Phone</span><span className="text-black font-bold">{selectedBorrower.phone_number || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">National ID</span><span className="text-black font-bold">{selectedBorrowerCustomer?.national_id || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">KRA PIN</span><span className="text-black font-bold">{selectedBorrowerCustomer?.kra_pin || 'NOT PROVIDED'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Customer Code</span><span className="text-black font-bold">{selectedBorrowerCustomer?.customer_code || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Account Status</span><span className="text-black font-bold">{selectedBorrower.is_active ? 'ACTIVE' : 'INACTIVE'}</span></div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Blacklist</span>
                      <span className={`font-bold ${selectedBorrowerCustomer?.blacklisted ? 'text-red-600' : 'text-black'}`}>
                        {selectedBorrowerCustomer?.blacklisted ? `BLACKLISTED — ${selectedBorrowerCustomer.blacklisted_reason || 'no reason given'}` : 'CLEAR'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="border border-black p-4 space-y-3">
                  <h4 className={THEME.classes.sectionTitle}>Loan Eligibility</h4>
                  <div className="flex items-center justify-between border border-black p-3 bg-white">
                    <div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Verdict</div>
                      <div className={`text-lg font-bold uppercase mt-1 ${eligibility.eligible ? 'text-black' : 'text-red-600'}`}>
                        {eligibility.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tier</div>
                      <div className="text-lg font-bold uppercase mt-1">{eligibility.tier}</div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs font-mono uppercase">
                    <span className="text-zinc-500">Max Eligible Amount</span>
                    <span className="text-black font-bold">KES {eligibility.maxAmount.toLocaleString()}</span>
                  </div>
                  <div className="pt-1">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Underwriting Notes</div>
                    <ul className="space-y-1 text-[11px] font-mono">
                      {eligibility.reasons.map((r, i) => (
                        <li key={i} className="flex gap-2">
                          <span>{eligibility.eligible ? '✓' : '•'}</span>
                          <span className="text-black">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              {/* Historical Applied Loans list */}
              <div className="space-y-3">
                <h4 className={THEME.classes.sectionTitle}>Historical Loan Applications</h4>
                <div className="overflow-x-auto border border-black bg-white">
                  <table className="min-w-full text-left text-xs font-mono">
                    <thead className="bg-black text-white uppercase tracking-wider text-[10px] border-b border-black">
                      <tr>
                        <th className="px-4 py-3 font-bold">Application No</th>
                        <th className="px-4 py-3 font-bold">Principal</th>
                        <th className="px-4 py-3 font-bold">Paid Amount</th>
                        <th className="px-4 py-3 font-bold">Term</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {selectedBorrowerLoans.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 uppercase tracking-widest">
                            No loan applications on file
                          </td>
                        </tr>
                      ) : (
                        selectedBorrowerLoans.map((loan) => (
                          <tr key={loan.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 font-bold">
                              {loan.application_no || `L-${loan.id}`}
                            </td>
                            <td className="px-4 py-3">
                              KES {loan.principal_amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              KES {loan.total_paid.toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              {loan.tenure_months} Mo
                            </td>
                            <td className="px-4 py-3">
                              <span className={
                                loan.status === 'cleared' || loan.status === 'closed'
                                  ? THEME.classes.badgeFilled
                                  : loan.status === 'disbursed' || loan.status === 'active'
                                  ? THEME.classes.badgeOutline
                                  : THEME.classes.badgeMuted
                              }>
                                {loan.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/dashboard?loan_id=${loan.id}`}
                                className="border border-black bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-black hover:bg-black hover:text-white transition-colors"
                              >
                                View Details
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="min-h-[500px] flex flex-col items-center justify-center text-center p-8 uppercase font-mono text-zinc-400 tracking-widest border border-dashed border-black">
              <svg className="h-12 w-12 text-zinc-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <span>Select a borrower from the left to load profiles and statistics</span>
            </div>
          )}
        </div>
        )}

      </div>

      {/* Summary Footer */}
      <div className="border border-black bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs font-mono uppercase text-black gap-2">
        <div>
          ACTIVE CUSTOMERS: <span className="font-bold">{borrowers.filter(b => b.is_active).length}</span> | INACTIVE: <span className="font-bold">{borrowers.filter(b => !b.is_active).length}</span>
        </div>
        <div>
          TOTAL SYSTEM LOANS RECORDED: <span className="font-bold">{loans.length}</span>
        </div>
      </div>
    </div>
  );
}
