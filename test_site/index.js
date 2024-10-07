// window.addEventListener('load', (event) => {
//     let chartData = [];
//     const myHeaders = new Headers();
//     myHeaders.append('content-type', 'application/json');

//     let requestOptions = {
//         method: 'GET',
//         headers: myHeaders,
//         redirect: 'follow'
//     };

//     fetch('http://localhost:3001/api/case/caseCountByDate', requestOptions).
//         then((response) => {
//             if (response.status === 200) {
//                 return response.json();
//             } else {
//                 return null;
//             }
//         }).then(
//             (result) => {
//                 if (result && result.length > 0) {
//                     let chartData = result;

//                     // Create the chart after data is fetched
//                     new Chart(
//                         document.getElementById('caseByDateCountChart'),
//                         {
//                             type: 'bar',
//                             data: {
//                                 labels: chartData.map(row => row.date_delivered),
//                                 datasets: [
//                                     {
//                                         label: 'Case Count By Date',
//                                         data: chartData.map(row => row.case_count),
//                                         backgroundColor: 'rgba(75, 192, 192, 0.2)',
//                                         borderColor: 'rgba(75, 192, 192, 1)',
//                                         borderWidth: 1
//                                     }
//                                 ]
//                             },
//                             options: {
//                                 scales: {
//                                     y: {
//                                         beginAtZero: true
//                                     }
//                                 }
//                             }
//                         }
//                     );
//                 }
//             }).catch(error => {
//                 console.log(error);
//             });

//     // if (chartData.length > 0) {

//     // }

// });

document.addEventListener('alpine:init', () => {
    Alpine.data('chartData', () => ({
        chart: null,
        data: [],
        init() {
            this.fetchData().then(() => this.createChart());
        },
        async fetchData() {
            try {
                const response = await fetch('http://localhost:3001/api/case/caseCountByDate', {
                    headers: { 'content-type': 'application/json' },
                });
                if (response.ok) {
                    this.data = await response.json();
                } else {
                    console.error('Failed to fetch data');
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        },
        createChart() {
            const ctx = document.getElementById('caseByDateCountChart');
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: this.data.map(row => row.date_delivered),
                    datasets: [{
                        label: 'Case Count By Date',
                        data: this.data.map(row => row.case_count),
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: { beginAtZero: true }
                    }
                },
                animations: {
                    tension: {
                        duration: 1000,
                        easing: 'linear',
                        from: 1,
                        to: 0,
                        loop: true
                    }
                },
                borderDash: [2]
            });
        },
        async refreshData() {
            await this.fetchData();
            this.updateChart();
        },
        updateChart() {
            if (this.chart) {
                this.chart.data.labels = this.data.map(row => row.date_delivered);
                this.chart.data.datasets[0].data = this.data.map(row => row.case_count);
                this.chart.update();
            }
        }
    }));
});