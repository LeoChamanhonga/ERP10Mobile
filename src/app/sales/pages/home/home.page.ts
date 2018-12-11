import { Component, ViewChild, OnInit } from '@angular/core';

import { Chart } from 'chart.js';
import { PopoverController, LoadingController } from '@ionic/angular';
import { CompanySelectorComponent, FooterTabMenu, FooterMenuItemSelectedEvent } from '../../components';
import { PageBase } from '../../../shared/pages';
import { SalesService, SalesServiceProvider } from '../../services';
import { Company, SalesCharts, CompanySales, ChartBundle, ChartData, Serie } from '../../entities';
import { LocaleService } from '../../../core/services';
import { CurrencyPipe } from '@angular/common';

@Component({
    templateUrl: 'home.page.html',
    styleUrls: ['home.page.scss'],
    providers: [SalesServiceProvider]
})
export class HomePage extends PageBase implements OnInit {

    private readonly yAxisNumberOfSteps = 4;
    private readonly currentYearAccentColor = '#1D317D';
    private readonly previouseYearAccentColor = '#DBE0EB';
    private readonly currentYearSeriesKey = '1';
    private readonly previousYearSeriesKey = '0';


    private chart: any;
    private companies: Company[];
    private salesCharts: SalesCharts;
    private yAxisMaxValues: number[];

    selectedCompanySales: CompanySales;
    selectedChartBundleKey: string;
    selectedChartBundlePeriodType: 'M' | 'W';
    selectedChartBundleLocalizedTitles: { [key: string]: string };
    selectedChartBundleIsTimeChart: boolean;
    extraInfoValue: string;

    selectedPeriod: string;

    showTimeFrameSelector: boolean;
    currentCurrency: string;
    currentYearLegend: string;
    previousYearLegend: string;
    yAxisScaleStep: number;
    yAxisScaleUnitPrefix: string;

    @ViewChild('chartCanvas') chartCanvas;

    timeFrame: 'monthly' | 'quarter';
    valueType: 'abs' | 'accum';
    viewType: 'chart' | 'table';

    footerTabMenus: FooterTabMenu[];

    public dataDate: Date;

    constructor(
        public popoverController: PopoverController,
        public loadingController: LoadingController,
        private salesService: SalesService,
        private localeService: LocaleService,
        private currencyPipe: CurrencyPipe
    ) {

        super(loadingController);

        this.dataDate = new Date();
        this.timeFrame = 'monthly';
        this.valueType = 'abs';
        this.viewType = 'chart';
        this.showTimeFrameSelector = true;
        this.selectedPeriod = '1';

        this.yAxisMaxValues = this.getPossibleMaximumYValues(this.yAxisNumberOfSteps);
    }

    async ngOnInit() {

        await this.showLoading();

        // get sales charts
        this.salesCharts = await this.salesService.getSalesCharts();

        // extract info from all companies
        this.companies = this.salesCharts.data.map(cs => ({ key: cs.key, name: cs.name }));

        // by default, select the first company
        this.selectedCompanySales = this.salesCharts.data[0];

        // by default, select the first chart bundle key
        this.selectedChartBundleKey = this.selectedCompanySales.chartBundle[0].key;

        // update view
        this.updateView();

        this.hideLoading();
    }

    async companySelectorAction(event: any) {
        const popover = await this.popoverController.create({
            component: CompanySelectorComponent,
            componentProps: {
                companies: this.companies
            },
            event: event,
            translucent: true
        });

        return await popover.present();
    }

    changeTimeFrameAction(timeFrame: 'monthly' | 'quarter') {
        this.timeFrame = timeFrame;
        this.updateView();
    }

    changeValueType(valueType: 'abs' | 'accum') {
        this.valueType = valueType;
        this.updateView();
    }

    toggleTableView() {
        this.viewType = this.viewType === 'table' ? 'chart' : 'table';
        this.updateView();
    }

    onFooterMenuItemSelected(event: FooterMenuItemSelectedEvent) {
        // select the option
        if (event.menu.key === 'share') {
            // for (const menuItem of event.menu.items) {
            //     menuItem.selected = menuItem === event.menuItem;
            // }
        } else {
            this.selectedChartBundleKey = event.menuItem.key;
            this.updateView();
        }
    }

    onPeriodChanged(period: string) {
        this.selectedPeriod = period;
        this.updateView();
    }

    private updateView() {

        const chartBundle = this.selectedCompanySales.chartBundle.find(b => b.key === this.selectedChartBundleKey);
        this.selectedChartBundleLocalizedTitles = chartBundle.titles;
        this.selectedChartBundleIsTimeChart = chartBundle.isTimeChart;
        this.selectedChartBundlePeriodType = chartBundle.periodType;
        this.updateFooterMenu(this.selectedCompanySales);
        this.updateChart(chartBundle, this.valueType, this.timeFrame, this.selectedPeriod, false);
    }

    private updateChart(
        chartBundle: ChartBundle,
        valueType: 'abs' | 'accum',
        timeFrame: 'monthly' | 'quarter',
        period: string,
        useReportingCurrency: boolean) {

        const currency = useReportingCurrency ? chartBundle.reportingCurrency : chartBundle.currency;
        const chart = chartBundle.charts.find(c => c.valueType === valueType);
        const chartType = valueType === 'accum' && chartBundle.isTimeChart ? 'line' : 'bar';

        this.currentCurrency = currency;

        const currentYearSerie = this.getSerieWithKey(chartBundle.series, this.currentYearSeriesKey);
        const previousYearSerie = this.getSerieWithKey(chartBundle.series, this.previousYearSeriesKey);

        this.currentYearLegend = currentYearSerie ? currentYearSerie.legend : null;
        this.previousYearLegend = previousYearSerie ? previousYearSerie.legend : null;

        let data: {
            maxValue: number,
            labels: string[],
            dataSets: { label: string, backgroundColor: string, data: number[] }[]
        };

        if (chartBundle.isTimeChart) {
            data = this.buildTimeChartData(chart, previousYearSerie, currentYearSerie, currency, useReportingCurrency);
        } else {
            data = this.buildTopChartData(chart, chartBundle, previousYearSerie, currentYearSerie, period, currency, useReportingCurrency);
        }

        // Y axis configurations
        const yAxisMaxValueStepAndUnit = this.calcYAxisMaxValueStepAndUnit(data.maxValue, this.yAxisNumberOfSteps, this.yAxisMaxValues);
        this.yAxisScaleStep = yAxisMaxValueStepAndUnit.yAxisScaleStep;
        this.yAxisScaleUnitPrefix = yAxisMaxValueStepAndUnit.yAxisScaleUnitPrefix;
        const yAxisMaxValue = yAxisMaxValueStepAndUnit.yAxisMaxValue;

        // if the chart change type, it needs to be created again
        if (this.chart && chartType !== this.chart.config.type) {
            this.chart.destroy();
            this.chart = null;
        }

        // create or update the chart config
        if (this.chart) {

            this.chart.type = chartType;
            this.chart.data.labels = data.labels;
            this.chart.data.datasets = data.dataSets;
            this.chart.options.scales.yAxes[0].ticks.max = yAxisMaxValue;
            this.chart.update();

        } else {

            this.chart = new Chart(this.chartCanvas.nativeElement, {
                type: chartType,
                data: {
                    labels: data.labels,
                    datasets: data.dataSets,
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    tooltips: {
                        enabled: false,
                        mode: 'x',
                        intersect: false,
                        custom: function (tooltipModel) {
                            // Tooltip Element
                            let tooltipEl = document.getElementById('chartjs-tooltip') as any;

                            // Create element on first render
                            if (!tooltipEl) {
                                tooltipEl = document.createElement('div');
                                tooltipEl.id = 'chartjs-tooltip';
                                // tooltipEl.innerHTML = `
                                // <div style="border:1px solid red; width:100%; height: 100%">
                                //     <div style="float:left; width:100%">${currentYearValue}</div>
                                //     <div style="float:left; width:100%">${previousYearValue}</div>
                                //     <div style="float:left; width:100%">${deltaValue}</div>
                                //     <div style="float:left; width:100%; height:1px; background:red"></div>
                                //     <div style="float:left; width:100%; text-align:center">
                                //         <div style="border:1px solid gray;">
                                //             ${label}
                                //         </div>
                                //     </div>
                                // </div>`;
                                document.body.appendChild(tooltipEl);
                            }

                            // Hide if no tooltip
                            if (tooltipModel.opacity === 0) {
                                tooltipEl.style.opacity = 0;
                                return;
                            }

                            // Set caret Position
                            tooltipEl.classList.remove('above', 'below', 'no-transform');
                            if (tooltipModel.yAlign) {
                                tooltipEl.classList.add(tooltipModel.yAlign);
                            } else {
                                tooltipEl.classList.add('no-transform');
                            }

                            const colIndex = tooltipModel.dataPoints[0].index;
                            const label = data.labels[colIndex];
                            const currentYearValue = data.dataSets[0].data[colIndex];
                            const previousYearValue = data.dataSets[1].data[colIndex];
                            const deltaValue = 0; //this.calcPercentageDeltaBetweenTwoNumbers(currentYearValue, previousYearValue);
                            
                            tooltipEl.innerHTML = `
                            <div style="width:100%; height: 100%">
                                <div style="float:left; width:100%">${currentYearValue}</div>
                                <div style="float:left; width:100%">${previousYearValue}</div>
                                <div style="float:left; width:100%">${deltaValue}</div>
                                <div style="border-left:1px solid red;
                                            border-top:1px solid red;
                                            float:left;
                                            height: calc(100% - 45px);
                                            width:100%;">
                                    <div style="border:1px solid gray;
                                                padding: 0 5px;
                                                text-align: center;
                                                left: 50%;
                                                transform: translateX(-50%);
                                                position: absolute;
                                                margin-top: 2px;
                                                font-weight: bold;
                                                font-size: 8pt;">
                                        ${label}
                                    </div>
                                </div>
                            </div>`;

                            // function getBody(bodyItem) {
                            //     return bodyItem.lines;
                            // }

                            // // Set Text
                            // if (tooltipModel.body) {
                            //     const titleLines = tooltipModel.title || [];
                            //     const bodyLines = tooltipModel.body.map(getBody);

                            //     let innerHtml = '<thead>';

                            //     titleLines.forEach(function (title) {
                            //         innerHtml += '<tr><th>' + title + '</th></tr>';
                            //     });
                            //     innerHtml += '</thead><tbody>';

                            //     bodyLines.forEach(function (body, i) {
                            //         const colors = tooltipModel.labelColors[i];
                            //         let style = 'background:' + colors.backgroundColor;
                            //         style += '; border-color:' + colors.borderColor;
                            //         style += '; border-width: 2px';
                            //         const span = '<span style="' + style + '"></span>';
                            //         innerHtml += '<tr><td>' + span + body + '</td></tr>';
                            //     });
                            //     innerHtml += '</tbody>';

                            //     const tableRoot = tooltipEl.querySelector('table');
                            //     tableRoot.innerHTML = innerHtml;
                            // }

                            // `this` will be the overall tooltip
                            const position = this._chart.canvas.getBoundingClientRect();

                            // Display, position, and set styles for font
                            tooltipEl.style.opacity = 1;
                            tooltipEl.style.width = '100px';
                            tooltipEl.style.height = '470px';

                            tooltipEl.style.position = 'absolute';
                            tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
                            tooltipEl.style.top = position.top + window.pageYOffset + 'px';
                             // position.top + window.pageYOffset + tooltipModel.caretY + 'px';
                            tooltipEl.style.fontFamily = tooltipModel._bodyFontFamily;
                            tooltipEl.style.fontSize = tooltipModel.bodyFontSize + 'px';
                            tooltipEl.style.fontStyle = tooltipModel._bodyFontStyle;
                            tooltipEl.style.padding = tooltipModel.yPadding + 'px ' + tooltipModel.xPadding + 'px';
                            tooltipEl.style.pointerEvents = 'none';
                        }
                    },
                    legend: {
                        display: false
                    },
                    scales: {
                        yAxes: [{
                            display: false,
                            ticks: {
                                beginAtZero: true,
                                maxTicksLimit: this.yAxisNumberOfSteps,
                                max: yAxisMaxValue
                            }
                        }],
                        xAxes: [
                            {
                                display: true,
                                gridLines: {
                                    display: false
                                }
                            }
                        ]
                    }
                }
            });
        }


        // let chartType: string;

        // const lastYearValues = [10, 12, 3, 5, 2, 3, 5, 12, 5, 8, 9, 12];
        // const currentYearValues = [5, 6, 6, 12, 5, 1, 11, 3, 2, 6, 4, 2];

        // let lastYearDatasetValues: number[] = [];
        // let currentYearDatasetValues: number[] = [];

        // switch (valueType) {
        //     case 'abs': {
        //         chartType = 'bar';
        //         currentYearDatasetValues = currentYearValues;
        //         lastYearDatasetValues = lastYearValues;
        //     }
        //     break;
        //     case 'accum': {
        //         chartType = 'line';

        //         currentYearDatasetValues = this.accumulateValues(currentYearValues);
        //         lastYearDatasetValues = this.accumulateValues(lastYearValues);
        //     }
        //     break;
        // }

        // switch (timeFrame) {
        //     case 'monthly': {
        //         labels = ['jan', 'feb', 'mar', 'apr', 'may', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        //     }
        //     break;   
        //     case 'quarter': {
        //         labels = ['Q1', 'Q2', 'Q3', 'Q4'];
        //         currentYearDatasetValues = this.aggregateValues(currentYearDatasetValues, 3);
        //         lastYearDatasetValues = this.aggregateValues(lastYearDatasetValues, 3);
        //     }
        //     break;
        // }

        // if (this.chart && chartType !== this.chart.config.type) {
        //     this.chart.destroy();
        //     this.chart = null;
        // }

        // if (this.chart) {
        //     this.chart.type = chartType;
        //     this.chart.data.labels = labels;
        //     this.chart.data.datasets[0].data = currentYearDatasetValues;
        //     this.chart.data.datasets[1].data = lastYearDatasetValues;
        //     this.chart.update();
        // } else {
        //     this.chart = new Chart(this.chartCanvas.nativeElement, {
        //         type: chartType,
        //         data: {
        //             labels: labels,
        //             datasets: [
        //                 {
        //                     label: '2018',
        //                     data: currentYearDatasetValues,
        //                     backgroundColor: 'rgba(81, 131, 255, .85)'
        //                 },
        //                 {
        //                     label: '2017',
        //                     data: lastYearDatasetValues,
        //                     backgroundColor: 'rgba(204, 204, 204, .85)'
        //                 }
        //             ],
        //         },
        //         options: {
        //             responsive: true,
        //             maintainAspectRatio: false,
        //             scales: {
        //                 yAxes: [{
        //                     ticks: {
        //                         beginAtZero: true
        //                     }
        //                 }],
        //                 xAxes: [
        //                     {
        //                         display: true,
        //                         gridLines: {
        //                             display: false
        //                         }
        //                     }
        //                 ]
        //             }
        //         }
        //     });
        // }
    }

    private updateFooterMenu(companySales: CompanySales) {

        const currentLanguage = this.localeService.language;

        const chartItems = companySales.chartBundle.map(cb => ({
            key: cb.key,
            label: cb.titles[currentLanguage],
            selected: () => cb.key === this.selectedChartBundleKey
        }));

        this.footerTabMenus = [
            {
                key: 'charts',
                icon: '../../../../assets/sales/footer-menu-charts.png',
                items: chartItems
            },
            {
                key: 'salesperson',
                icon: '../../../../assets/sales/footer-menu-salesperson.png',
                items: [
                    {
                        key: 'sp1',
                        label: 'Sales Person 1'
                    },
                    {
                        key: 'sp2',
                        label: 'Sales Person 2'
                    }
                ]
            },
            {
                key: 'share',
                icon: '../../../../assets/sales/footer-menu-share.png',
                items: [
                    {
                        key: 'send_chart_by_email',
                        label: 'Send chart by email'
                    },
                    {
                        key: 'send_pdf_chart_by_email',
                        label: 'Send PDF chart by email'
                    },
                    {
                        key: 'save_image_in_the_gallery',
                        label: 'Save Image in the gallery'
                    }
                ]
            }
        ];
    }

    private accumulateValues(values: number[]): number[] {
        let accomulatedValue = 0;
        const accumulatedValues = [];
        for (let i = 0; i < values.length; i++) {
            accomulatedValue += values[i];
            accumulatedValues.push(accomulatedValue);
        }

        return accumulatedValues;
    }

    private aggregateValues(values: number[], amount: number) {
        const aggregatedValues = [];
        let aggregatedValue = 0;

        for (let i = 0; i < values.length; i++) {
            aggregatedValue += values[i];
            aggregatedValues.push(aggregatedValue);

            if (i % amount === 0) {
                aggregatedValues.push(aggregatedValue);
                aggregatedValue = 0;
            }
        }

        if (aggregatedValue !== 0) {
            aggregatedValues.push(aggregatedValue);
        }

        return aggregatedValues;
    }

    private getPossibleMaximumYValues(yAxisNumberOfSteps: number): number[] {

        let baseTicks = yAxisNumberOfSteps;
        let baseLcm = this.lcm(yAxisNumberOfSteps, 10);

        while (baseTicks > 10) {
            baseTicks /= 10;
            baseLcm /= 10;
        }

        let limitTicks = baseTicks * 10;

        let limitLcm = 1;
        while (limitLcm < limitTicks) {
            limitLcm *= 10;
        }


        let mode = true;
        let value = baseTicks;
        const values: number[] = [];

        while (value < 10000) {

            if (value < 10 && value + baseTicks < 10) {
                value += baseTicks;
                continue;
            }

            if (mode) {

                value += baseTicks;
                if (value >= limitTicks) {
                    mode = false;
                    baseTicks *= 10;
                    limitTicks *= 10;
                }

            } else {

                value += baseLcm;
                if (value >= limitLcm && (value % baseTicks === 0)) {
                    mode = true;
                    baseLcm *= 10;
                    limitLcm *= 10;
                }

            }

            if (value < 10000) {
                const dividend = value;
                const divisor = 10;
                values.push(dividend / divisor);
            }
        }

        return values;
    }

    private calcYAxisMaxValueStepAndUnit(maximumValue: number, yAxisNumberOfSteps: number, yAxisMaxValues: number[])
        : { yAxisMaxValue: number, yAxisScaleStep: number, yAxisScaleUnitPrefix: string } {

        let divider = 1;
        const thousandDecimal = 1000;

        while (!((maximumValue / divider) < thousandDecimal)) {
            divider *= 1000;
        }

        const baseMaximum = maximumValue / divider;

        let scaleMaximum: number = null;

        for (const possibleMaximum of yAxisMaxValues) {
            if (baseMaximum < possibleMaximum) {
                scaleMaximum = possibleMaximum;
                break;
            }
        }

        if (!scaleMaximum) {
            scaleMaximum = yAxisMaxValues[0];
            divider *= 1000;
        }

        let prefix = 'T';

        switch (divider) {
            case 1: prefix = ''; break;
            case 1000: prefix = 'K'; break;
            case 1000000: prefix = 'M'; break;
            case 1000000000: prefix = 'B'; break;
        }

        const yMaximumValue = scaleMaximum * divider;
        const yScaleStep = scaleMaximum / yAxisNumberOfSteps;

        return {
            yAxisMaxValue: yMaximumValue,
            yAxisScaleStep: yScaleStep,
            yAxisScaleUnitPrefix: prefix
        };
    }

    private lcm(x: number, y: number) {
        const l = Math.min(x, y);
        const h = Math.max(x, y);
        const m = l * h;

        for (let i = h; i < m; i += h) {
            if (i % l === 0) {
                return i;
            }
        }

        return m;
    }

    private buildTimeChartData(
        chart: ChartData,
        previousYearSerie: Serie,
        currentYearSerie: Serie,
        currency: string,
        useReportingValue: boolean)
        : {
            maxValue: number,
            labels: string[],
            dataSets: { label: string, backgroundColor: string, data: number[] }[]
        } {


        // get chart total
        this.extraInfoValue = '';
        const totalDataSet = chart.dataSet.find(ds => ds.hasTotal);
        if (totalDataSet) {
            const totalDataPoint = totalDataSet.dataPoints.find(dp => dp.isTotal);

            if (totalDataPoint) {
                const value = this.getCorrectValue(totalDataPoint.values[1], useReportingValue);
                const moneyValue = this.currencyPipe.transform(value, currency);
                this.extraInfoValue = `#Total sales: ${moneyValue}`;
            }
        }


        const labels: string[] = [];
        const dataSets: { label: string, backgroundColor: string, data: number[] }[] = [];
        let maxValue = 0;

        // current year serie
        dataSets.push(
            {
                label: currentYearSerie.legend,
                data: [],
                backgroundColor: (this.currentYearAccentColor + '80')
            }
        );

        // previous year serie
        dataSets.push(
            {
                label: previousYearSerie.legend,
                data: [],
                backgroundColor: this.previouseYearAccentColor + '80'
            }
        );

        // right display order series
        const series = [currentYearSerie, previousYearSerie];

        for (const dataSet of chart.dataSet) {
            // the Monthly Chart has always only one set of datapoins
            const dataPoint = dataSet.dataPoints[0];

            // the dataPoint with total values is not used on the chart
            if (dataPoint.isTotal) {
                continue;
            }

            labels.push(dataPoint.label);

            for (let i = 0; i < series.length; i++) {
                const serie = series[i];
                const value = dataPoint.values.find(v => v.seriesKey === serie.key);
                let finalValue = 0;

                if (value) {
                    finalValue = this.getCorrectValue(value, useReportingValue);
                    maxValue = finalValue > maxValue ? finalValue : maxValue;
                }

                dataSets[i].data.push(finalValue);
            }
        }

        return {
            dataSets: dataSets,
            maxValue: maxValue,
            labels: labels
        };
    }

    private buildTopChartData(
        chart: ChartData,
        chartBundle: ChartBundle,
        previousYearSerie: Serie,
        currentYearSerie: Serie,
        period: string,
        currency: string,
        useReportingValue: boolean)
        : {
            maxValue: number,
            labels: string[],
            dataSets: { label: string, backgroundColor: string, data: number[] }[]
        } {

        const labels: string[] = [];
        const dataSets: { label: string, backgroundColor: string, data: number[] }[] = [];
        let maxValue = 0;

        for (const serie of chartBundle.series) {
            dataSets.push(
                {
                    label: serie.legend,
                    data: [],
                    backgroundColor: serie.key === '0' ? this.previouseYearAccentColor : this.currentYearAccentColor
                }
            );
        }

        const dataSet = chart.dataSet.find(ds => ds.period === period);


        // get others total
        this.extraInfoValue = '';
        const othersDataPoint = dataSet.dataPoints.find(dp => dp.label === '@@OTHERS@@');
        const totalsDataPoint = dataSet.dataPoints.find(dp => dp.isTotal);
        if (othersDataPoint && totalsDataPoint) {
            const otherValue = this.getCorrectValue(othersDataPoint.values[1], useReportingValue);
            const totalValue = this.getCorrectValue(totalsDataPoint.values[1], useReportingValue);
            const moneyValue = this.currencyPipe.transform(otherValue, currency);
            const ratioPercentage = this.calcPercentageRatioBetweenTwoNumbers(otherValue, otherValue + totalValue, true);
            const rationString = ratioPercentage === 0 ? 'N/A' : `${ratioPercentage}%`;
            this.extraInfoValue = `#Others: ${moneyValue} // ${rationString}`;
        }


        for (const dataPoint of dataSet.dataPoints) {

            // the dataPoint with total values or label '@@OTHERS@@' are not used on the chart
            if (dataPoint.isTotal || dataPoint.label === '@@OTHERS@@') {
                continue;
            }

            labels.push(dataPoint.label.substr(0, 5));

            for (let i = 0; i < chartBundle.series.length; i++) {
                const serie = chartBundle.series[i];
                const value = dataPoint.values.find(v => v.seriesKey === serie.key);
                let finalValue = 0;

                if (value) {
                    finalValue = this.getCorrectValue(value, useReportingValue);
                    maxValue = finalValue > maxValue ? finalValue : maxValue;
                }

                dataSets[i].data.push(finalValue);
            }
        }

        return {
            dataSets: dataSets,
            maxValue: maxValue,
            labels: labels
        };
    }

    private getCorrectValue(value: { seriesKey: string, value: number, reportingValue: number }, useReportingValue: boolean): number {
        return useReportingValue ? value.reportingValue : value.value;
    }

    private calcPercentageDeltaBetweenTwoNumbers(valueA: number, valueB: number, roundValue?: boolean) {
        if (!valueA || valueA === 0) {
            return 0;
        }

        let delta = ((valueB - valueA) / Math.abs(valueA)) * 100;
        delta = roundValue ? Math.round(delta) : delta;
        return delta;
    }

    private calcPercentageRatioBetweenTwoNumbers(valueA: number, valueB: number, roundValue?: boolean) {
        if (!valueB || valueB === 0) {
            return 0;
        }

        let ratio = (valueA / valueB) * 100;
        ratio = roundValue ? Math.round(ratio) : ratio;
        return ratio;
    }

    private getSerieWithKey(series: Serie[], key: string): Serie {
        if (!series) {
            return null;
        }

        return series.find(s => s.key === key);
    }
}
