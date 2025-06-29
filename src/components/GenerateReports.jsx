import React, { useState, useEffect } from 'react';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Card, Button, Select, Radio, Spin, message } from 'antd';
import { BarChartOutlined, FileTextOutlined, PieChartOutlined, TableOutlined } from '@ant-design/icons';
import '../styles/GenerateReports.css';

const { Option } = Select;

const GenerateReports = () => {
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [reportType, setReportType] = useState('academic');
  const [dateRange, setDateRange] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection'
    }
  ]);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    // Fetch available classes
    const fetchClasses = async () => {
      try {
        // TODO: Replace with actual API call
        setClasses(['Panda', 'Curious Cubs', 'Little Lions']);
      } catch (error) {
        message.error('Failed to fetch classes');
      }
    };
    fetchClasses();
  }, []);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      // TODO: Implement report generation API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
      message.success({
        content: 'Report generated successfully!',
        className: 'custom-message',
        duration: 3,
      });
    } catch (error) {
      message.error({
        content: 'Failed to generate report',
        className: 'custom-message',
        duration: 3,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 transition-colors duration-200">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-gray-100">Generate Reports</h1>
          <p className="text-lg text-gray-300">Create detailed reports for your classes and students</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Report Configuration Card */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gray-800 border-gray-700">
            <h2 className="text-2xl font-semibold mb-8 text-gray-100">Report Configuration</h2>
            
            <div className="space-y-8">
              {/* Report Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Report Type</label>
                <Radio.Group 
                  value={reportType} 
                  onChange={e => setReportType(e.target.value)}
                  className="grid grid-cols-2 gap-4"
                >
                  <Radio.Button value="academic" className="text-center py-4 flex items-center justify-center text-gray-300 border-gray-600 bg-gray-700">
                    <BarChartOutlined className="mr-2 text-lg" />
                    <span>Academic Progress</span>
                  </Radio.Button>
                  <Radio.Button value="attendance" className="text-center py-4 flex items-center justify-center text-gray-300 border-gray-600 bg-gray-700">
                    <PieChartOutlined className="mr-2 text-lg" />
                    <span>Attendance</span>
                  </Radio.Button>
                  <Radio.Button value="behavior" className="text-center py-4 flex items-center justify-center text-gray-300 border-gray-600 bg-gray-700">
                    <TableOutlined className="mr-2 text-lg" />
                    <span>Behavior</span>
                  </Radio.Button>
                  <Radio.Button value="comprehensive" className="text-center py-4 flex items-center justify-center text-gray-300 border-gray-600 bg-gray-700">
                    <FileTextOutlined className="mr-2 text-lg" />
                    <span>Comprehensive</span>
                  </Radio.Button>
                </Radio.Group>
              </div>

              {/* Class Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Class</label>
                <Select
                  placeholder="Select a class"
                  className="w-full"
                  value={selectedClass}
                  onChange={setSelectedClass}
                  size="large"
                  dropdownClassName="bg-gray-700 text-gray-300"
                >
                  {classes.map(cls => (
                    <Option key={cls} value={cls} className="bg-gray-700 text-gray-300">{cls}</Option>
                  ))}
                </Select>
              </div>

              {/* Date Range Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Date Range</label>
                <div className="date-range-wrapper border rounded-lg overflow-hidden border-gray-600">
                  <DateRangePicker
                    onChange={item => setDateRange([item.selection])}
                    moveRangeOnFirstSelection={false}
                    ranges={dateRange}
                    className="w-full bg-gray-700"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Preview Card */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gray-800 border-gray-700">
            <h2 className="text-2xl font-semibold mb-8 text-gray-100">Report Preview</h2>
            <div className="preview-section bg-gray-700">
              {loading ? (
                <Spin size="large" />
              ) : (
                <div className="text-center text-gray-400">
                  <FileTextOutlined style={{ fontSize: '64px' }} className="text-blue-400 mb-4" />
                  <p className="text-lg">Configure your report settings to see a preview</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Generate Button */}
        <div className="mt-12 flex justify-end">
          <Button
            type="primary"
            size="large"
            onClick={handleGenerateReport}
            loading={loading}
            disabled={!selectedClass || !reportType}
            className="bg-blue-700 hover:bg-blue-800 text-white px-12 h-12 text-lg flex items-center"
            icon={<FileTextOutlined />}
          >
            Generate Report
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GenerateReports; 