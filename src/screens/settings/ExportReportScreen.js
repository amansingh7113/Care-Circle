import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { PDFDocument } from 'pdf-lib';
import { THEME } from '../../styles/theme';
import { fetchExportData } from '../../services/exportApi';

const ExportReportScreen = ({ navigation }) => {
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const data = await fetchExportData(selectedMonths);
      const html = generateHTML(data);
      const { uri } = await Print.printToFileAsync({ html });
      
      let finalUri = uri;

      // Extract and merge PDF documents
      const pdfDocs = data.documents.filter(d => d.file_url && d.file_url.toLowerCase().includes('.pdf'));

      if (pdfDocs.length > 0) {
        try {
          const mainPdfBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          const mergedPdf = await PDFDocument.load(mainPdfBase64);

          for (const doc of pdfDocs) {
            try {
              const tempFileUri = FileSystem.cacheDirectory + `temp_${Date.now()}.pdf`;
              await FileSystem.downloadAsync(doc.file_url, tempFileUri);
              
              const docBase64 = await FileSystem.readAsStringAsync(tempFileUri, { encoding: FileSystem.EncodingType.Base64 });
              const extPdf = await PDFDocument.load(docBase64);
              
              const copiedPages = await mergedPdf.copyPages(extPdf, extPdf.getPageIndices());
              copiedPages.forEach(page => mergedPdf.addPage(page));
            } catch (err) {
              console.warn('Failed to merge pdf:', doc.title, err);
            }
          }

          const finalBase64 = await mergedPdf.saveAsBase64();
          const mergedFileUri = FileSystem.cacheDirectory + `CareCircle_Report_${Date.now()}.pdf`;
          await FileSystem.writeAsStringAsync(mergedFileUri, finalBase64, { encoding: FileSystem.EncodingType.Base64 });
          finalUri = mergedFileUri;
        } catch (mergeErr) {
          console.warn('PDF Merge failed, falling back to basic report:', mergeErr);
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(finalUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share CareCircle Report',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Success', `Report generated and saved to: ${finalUri}`);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to generate the report. Please try again later.');
    } finally {
      setIsGenerating(false);
    }
  };

  const aggregateStepsWeekly = (stepsData) => {
    if (!stepsData || stepsData.length === 0) return [];
    
    // Sort by date ascending
    const sorted = [...stepsData].sort((a, b) => new Date(a.date) - new Date(b.date));
    const weeks = [];
    let currentWeekStart = new Date(sorted[0].date);
    let currentWeekSum = 0;
    
    sorted.forEach((log) => {
      const logDate = new Date(log.date);
      const diffTime = Math.abs(logDate - currentWeekStart);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays >= 7) {
        weeks.push({
          start: currentWeekStart.toISOString().split('T')[0],
          end: new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          totalSteps: currentWeekSum
        });
        currentWeekStart = logDate;
        currentWeekSum = log.step_count;
      } else {
        currentWeekSum += log.step_count;
      }
    });
    
    // Add the last week
    weeks.push({
      start: currentWeekStart.toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
      totalSteps: currentWeekSum
    });
    
    return weeks.reverse(); // Newest first
  };

  const generateHTML = (data) => {
    const primaryColor = '#1A73E8';
    
    // Aggregate data
    const weeklySteps = aggregateStepsWeekly(data.steps);
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>CareCircle Health Report</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid ${primaryColor}; padding-bottom: 20px; margin-bottom: 40px; }
          .header h1 { color: ${primaryColor}; margin: 0; font-size: 28px; }
          .header p { color: #666; margin: 5px 0 0 0; font-size: 14px; }
          .section { margin-bottom: 40px; }
          .section-title { color: ${primaryColor}; font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { text-align: left; padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
          th { background-color: #f8f9fa; color: #555; font-weight: 600; }
          .empty-state { color: #999; font-style: italic; font-size: 14px; }
          .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .status-taken { background-color: #e6f4ea; color: #1e8e3e; }
          .status-missed { background-color: #fce8e6; color: #d93025; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CareCircle Health Report</h1>
          <p>Timeframe: Last ${data.period.months} Month${data.period.months > 1 ? 's' : ''}</p>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
    `;

    // 1. Blood Pressure Section
    html += `<div class="section"><h2 class="section-title">Blood Pressure Logs</h2>`;
    if (data.bloodPressure.length > 0) {
      html += `<table><tr><th>Date</th><th>Systolic/Diastolic</th><th>Pulse</th></tr>`;
      data.bloodPressure.forEach(bp => {
        html += `<tr>
          <td>${new Date(bp.logged_at).toLocaleDateString()}</td>
          <td>${bp.systolic} / ${bp.diastolic} mmHg</td>
          <td>${bp.pulse || '-'} bpm</td>
        </tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p class="empty-state">No blood pressure logs found for this period.</p>`;
    }
    html += `</div>`;

    // 2. Sleep Logs (Daily)
    html += `<div class="section"><h2 class="section-title">Sleep Logs (Daily)</h2>`;
    if (data.sleep.length > 0) {
      html += `<table><tr><th>Date</th><th>Duration</th><th>Detected By</th></tr>`;
      data.sleep.forEach(s => {
        const hours = Math.floor(s.duration_minutes / 60) || 0;
        const mins = (s.duration_minutes % 60) || 0;
        html += `<tr>
          <td>${new Date(s.sleep_start).toLocaleDateString()}</td>
          <td>${hours}h ${mins}m</td>
          <td>${s.is_auto_detected ? 'Device' : 'Manual'}</td>
        </tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p class="empty-state">No sleep logs found for this period.</p>`;
    }
    html += `</div>`;

    // 3. Steps (Weekly)
    html += `<div class="section"><h2 class="section-title">Steps (Weekly Aggregation)</h2>`;
    if (weeklySteps.length > 0) {
      html += `<table><tr><th>Week Starting</th><th>Total Steps</th></tr>`;
      weeklySteps.forEach(w => {
        html += `<tr>
          <td>${new Date(w.start).toLocaleDateString()}</td>
          <td>${w.totalSteps.toLocaleString()}</td>
        </tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p class="empty-state">No step logs found for this period.</p>`;
    }
    html += `</div>`;

    // 4. Medications
    html += `<div class="section"><h2 class="section-title">Medication Logs</h2>`;
    if (data.medicines.length > 0) {
      html += `<table><tr><th>Date & Time</th><th>Medicine</th><th>Dosage</th><th>Status</th></tr>`;
      data.medicines.forEach(m => {
        const badgeClass = m.status === 'taken' ? 'status-taken' : 'status-missed';
        html += `<tr>
          <td>${new Date(m.taken_at).toLocaleString()}</td>
          <td>${m.medicines?.name || 'Unknown'}</td>
          <td>${m.medicines?.dosage || '-'}</td>
          <td><span class="status-badge ${badgeClass}">${m.status.toUpperCase()}</span></td>
        </tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p class="empty-state">No medication logs found for this period.</p>`;
    }
    html += `</div>`;

    // 5. Prescriptions & Reports (Documents)
    html += `<div class="section"><h2 class="section-title">Prescriptions & Reports</h2>`;
    if (data.documents.length > 0) {
      html += `<table><tr><th>Date Added</th><th>Title</th><th>Category</th></tr>`;
      data.documents.forEach(d => {
        html += `<tr>
          <td style="vertical-align: top;">${new Date(d.created_at).toLocaleDateString()}</td>
          <td style="vertical-align: top;">
            <strong>${d.title}</strong>
            <div style="margin-top: 10px;">
              ${
                d.file_url && (d.file_url.toLowerCase().includes('.jpg') || d.file_url.toLowerCase().includes('.jpeg') || d.file_url.toLowerCase().includes('.png'))
                  ? `<img src="${d.file_url}" style="max-width: 300px; max-height: 300px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; padding: 4px;" alt="Document Image" />`
                  : d.file_url && d.file_url.toLowerCase().includes('.pdf')
                    ? `<span style="color: #1e8e3e; font-size: 12px; font-weight: bold;">(PDF Appended to this report)</span>`
                    : ''
              }
            </div>
          </td>
          <td style="vertical-align: top;">${d.category}</td>
        </tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p class="empty-state">No documents found for this period.</p>`;
    }
    html += `</div>`;

    html += `
      <div style="text-align: center; margin-top: 50px; color: #aaa; font-size: 12px;">
        Generated by CareCircle App
      </div>
      </body></html>
    `;

    return html;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.header}>Export Report</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Generate a beautiful PDF report containing sleep, steps, medications, blood pressure, and document records.
        </Text>

        <Text style={styles.label}>Select Timeframe</Text>
        <View style={styles.optionsContainer}>
          {[1, 3, 6].map((months) => (
            <TouchableOpacity 
              key={months} 
              style={[styles.optionCard, selectedMonths === months && styles.optionCardActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedMonths(months);
              }}
            >
              <Text style={[styles.optionText, selectedMonths === months && styles.optionTextActive]}>
                Last {months} Month{months > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator color={THEME.colors.cardBg} />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={20} color={THEME.colors.cardBg} />
              <Text style={styles.generateButtonText}>Generate PDF Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas, padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: 40 },
  header: { ...THEME.typography.header, color: THEME.colors.primary, marginBottom: 0, marginTop: 0 },
  backBtn: { padding: 8, marginLeft: -8 },
  description: { ...THEME.typography.body, color: THEME.colors.textBody, marginBottom: 32, lineHeight: 22 },
  label: { ...THEME.typography.cardTitle, marginBottom: 16 },
  optionsContainer: { flexDirection: 'column', gap: 12, marginBottom: 40 },
  optionCard: {
    backgroundColor: THEME.colors.cardBg,
    padding: 16,
    borderRadius: THEME.borderRadius.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    ...THEME.shadows.soft
  },
  optionCardActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: `${THEME.colors.primary}10`,
  },
  optionText: { ...THEME.typography.body, fontWeight: '600', color: THEME.colors.textHeader },
  optionTextActive: { color: THEME.colors.primary, fontWeight: 'bold' },
  generateButton: {
    backgroundColor: THEME.colors.primary,
    padding: 16,
    borderRadius: THEME.borderRadius.badge,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...THEME.shadows.medium
  },
  generateButtonDisabled: {
    opacity: 0.7
  },
  generateButtonText: {
    color: THEME.colors.cardBg,
    fontWeight: 'bold',
    fontSize: 16
  }
});

export default ExportReportScreen;
