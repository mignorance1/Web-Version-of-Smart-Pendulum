// export.js
// 数据导出与报告生成模块

console.log('export.js文件开始加载 - 立即执行');

/**
 * ExportModule 负责实验数据的导出（CSV）和实验报告生成
 */
export const ExportModule = {
  /**
   * 初始化导出模块，绑定导出按钮事件
   */
  init() {
    console.log('ExportModule.init()被调用');
    
    // 动态创建导出按钮并绑定事件
    let exportBtn = document.getElementById('exportBtn');
    if (!exportBtn) {
      exportBtn = document.createElement('button');
      exportBtn.id = 'exportBtn';
      exportBtn.textContent = '导出数据';
      // 统一使用现代按钮中等尺寸
      exportBtn.className = 'modern-btn medium';
    } else {
      // 统一规范已有按钮的样式
      exportBtn.className = 'modern-btn medium';
      // 清除内联尺寸与外边距，避免样式漂移
      exportBtn.style.margin = '';
      exportBtn.style.width = '';
      exportBtn.style.height = '';
      exportBtn.style.padding = '';
    }
    // 新增：生成可视化分析按钮
    console.log('准备创建可视化分析按钮');
    let visualizationBtn = document.getElementById('visualizationBtn');
    if (!visualizationBtn) {
      visualizationBtn = document.createElement('button');
      visualizationBtn.id = 'visualizationBtn';
      visualizationBtn.textContent = '生成可视化分析';
      visualizationBtn.className = 'modern-btn medium';
      console.log('可视化分析按钮创建完成');
      // 移除内联样式，使用CSS类
    }
    // 新增：生成实验报告按钮
    let reportBtn = document.getElementById('reportBtn');
    if (!reportBtn) {
      reportBtn = document.createElement('button');
      reportBtn.id = 'reportBtn';
      reportBtn.textContent = '生成实验报告';
      reportBtn.className = 'modern-btn medium';
    }
    // 新增：导出角度与时间数据按钮
    let exportAngleTimeBtn = document.getElementById('exportAngleTimeBtn');
    if (!exportAngleTimeBtn) {
      exportAngleTimeBtn = document.createElement('button');
      exportAngleTimeBtn.id = 'exportAngleTimeBtn';
      exportAngleTimeBtn.textContent = '导出角度-时间数据';
      exportAngleTimeBtn.className = 'modern-btn medium';
    }
    // 创建按钮容器并插入到controls-section最下方
    console.log('准备创建按钮容器');
    let buttonContainer = document.getElementById('exportButtonContainer');
    if (!buttonContainer) {
      buttonContainer = document.createElement('div');
      buttonContainer.id = 'exportButtonContainer';
      buttonContainer.className = 'modern-btn-group';
      buttonContainer.style.cssText = `
        justify-content: center;
        margin: 20px auto;`;
      console.log('按钮容器创建完成');
    }
    // 清空容器再添加按钮，避免重复
    buttonContainer.innerHTML = '';
    buttonContainer.appendChild(exportBtn);
    buttonContainer.appendChild(visualizationBtn);
    buttonContainer.appendChild(reportBtn);
    buttonContainer.appendChild(exportAngleTimeBtn);
    
    const controlsSection = document.querySelector('.controls-section');
    if (controlsSection) {
      controlsSection.appendChild(buttonContainer);
    } else {
      document.body.appendChild(buttonContainer);
    }
    // 绑定事件
    exportBtn.onclick = () =>{
      this.exportCSV();
      console.log('导出数据按钮被点击');
    }
    visualizationBtn.onclick = () => {
      console.log('生成可视化分析按钮被点击');
      this.showVisualizationAnalysis();
    };
    reportBtn.onclick = () => {
      console.log('生成实验报告按钮被点击');
      this.generateReport();
    };
    exportAngleTimeBtn.onclick = () => {
      console.log('导出角度与时间数据按钮被点击');
      this.exportAngleTimeData();
    };  
  },

  /**
   * 导出CSV数据
   * 依赖 window.experimentGroups
   */
  exportCSV() {
    if (!window.experimentGroups || !window.experimentGroups.length) {
      alert('没有可导出的实验数据！');
      return;
    }
    let csv = '实验编号,初始角度(°),摆长(cm),周期编号,本周期时长(s),累计时长(s),重力加速度(m/s²)\n';
    window.experimentGroups.forEach((exp, expIdx) => {
      if (exp.periods && exp.periods.length > 0) {
        // 过滤掉duration为0的周期数据
        const validPeriods = exp.periods.filter(p => p.duration > 0);
        
        if (validPeriods.length > 0) {
          validPeriods.forEach((p, i) => {
            csv += [
              expIdx + 1,
              exp.initialAngle,
              exp.length,
              p.index, // 使用已经重新编号的周期编号
              p.duration.toFixed(4),
              p.total.toFixed(4),
              (i === 0 ? (exp.gravity?.toFixed(4) || '') : '')
            ].join(',') + '\n';
          });
        } else {
          // 如果没有有效周期数据，只导出实验基本信息
          csv += [
            expIdx + 1,
            exp.initialAngle,
            exp.length,
            '', '', '', exp.gravity?.toFixed(4) || ''
          ].join(',') + '\n';
        }
      } else {
        csv += [
          expIdx + 1,
          exp.initialAngle,
          exp.length,
          '', '', '', exp.gravity?.toFixed(4) || ''
        ].join(',') + '\n';
      }
    });
    // 添加UTF-8 BOM头
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '实验数据.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * 导出角度与时间数据
   * 记录从WebSocket获取的angle_history数据，时间精确到小数点后三位
   */
  exportAngleTimeData() {
    // 使用全局的AngleTimeRecorder获取数据
    console.log('准备导出角度-时间数据...');
    console.log('AngleTimeRecorder状态:', window.PendulumApp?.AngleTimeRecorder);
    
    if (!window.PendulumApp || !window.PendulumApp.AngleTimeRecorder) {
      alert('角度记录器未初始化！请刷新页面重试。');
      console.error('AngleTimeRecorder未找到');
      return;
    }
    
    const angleTimeData = window.PendulumApp.AngleTimeRecorder.getData();
    console.log('获取到的数据:', angleTimeData);
    console.log('数据长度:', angleTimeData?.length);

    if (!angleTimeData || !angleTimeData.length) {
      const isRecording = window.PendulumApp.AngleTimeRecorder.isRecording;
      const message = isRecording 
        ? '没有可导出的角度与时间数据！数据可能还在收集中，请稍后再试。\n\n提示：确保WebSocket已连接并正在接收角度数据。'
        : '没有可导出的角度与时间数据！请先点击"开始实验"按钮开始记录数据。';
      alert(message);
      console.warn('导出失败：', { 
        dataLength: angleTimeData?.length || 0, 
        isRecording,
        hasRecorder: !!window.PendulumApp.AngleTimeRecorder
      });
      return;
    }

    let csv = '时间(秒),角度(度)\n';
    angleTimeData.forEach((data, index) => {
      csv += [
        data.time.toFixed(3),
        data.angle.toFixed(3)
      ].join(',') + '\n';
    });

    // 添加UTF-8 BOM头
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '角度与时间数据.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * 生成实验报告（HTML文件下载）
   * 依赖 processExperimentData
   */
  async generateReport() {
    const data = this.processExperimentData();
    
    // 获取后端配置：是否使用静态图片
    let useStaticCharts = 1; // 默认使用静态图片
    try {
      const response = await fetch('http://127.0.0.1:5000/get_chart_config');
      if (response.ok) {
        const config = await response.json();
        useStaticCharts = config.use_static_charts || 1;
      }
    } catch (e) {
      console.warn('获取图表配置失败，使用默认配置（静态图片）:', e);
    }

    let pics;
    if (useStaticCharts === 1) {
      // 使用静态图片（可视化分析文件夹中的图片）
      pics = [
        { key: 'imgTL', path: '可视化分析/T-L曲线拟合.png', alt: 'T-L曲线拟合' },
        { key: 'imgSqrt', path: '可视化分析/T-根号L直线拟合.png', alt: 'T-根号L直线拟合' },
        { key: 'imgGL', path: '可视化分析/g与L的关系.png', alt: 'g与L的关系' },
        { key: 'imgTheta', path: '可视化分析/摆角与周期关系.png', alt: '摆角与周期关系' }
      ];

      const toDataURL = (url) => new Promise((resolve) => {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = function() {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch (e) { resolve(url); }
          };
          img.onerror = function() { resolve(url); };
          img.src = url;
        } catch (e) { resolve(url); }
      });

      Promise.all(pics.map(async p => ({ key: p.key, alt: p.alt, data: await toDataURL(p.path) }))).then((arr) => {
        this._generateReportHTML(data, arr);
      });
    } else {
      // 使用实验数据动态生成的图片
      // 先绘制图表到临时canvas，然后转换为图片
      const chartCanvases = [
        { id: 'tempChart1', width: 400, height: 300, drawFunc: this.drawTvsLChart.bind(this) },
        { id: 'tempChart2', width: 400, height: 300, drawFunc: this.drawTvsSqrtLChart.bind(this) },
        { id: 'tempChart3', width: 400, height: 300, drawFunc: this.drawGvsLChart.bind(this) },
        { id: 'tempChart4', width: 400, height: 300, drawFunc: this.drawTvsSmallThetaChart.bind(this) }
      ];

      const pics = [
        { key: 'imgTL', alt: 'T-L曲线拟合' },
        { key: 'imgSqrt', alt: 'T-根号L直线拟合' },
        { key: 'imgGL', alt: 'g与L的关系' },
        { key: 'imgTheta', alt: '摆角与周期关系' }
      ];

      // 创建临时canvas并绘制图表
      const tempCanvases = chartCanvases.map((chart, index) => {
        const canvas = document.createElement('canvas');
        canvas.id = chart.id;
        canvas.width = chart.width;
        canvas.height = chart.height;
        chart.drawFunc(data, canvas);
        return { canvas, pic: pics[index] };
      });

      // 等待一小段时间确保绘制完成
      setTimeout(() => {
        const arr = tempCanvases.map(({ canvas, pic }) => ({
          key: pic.key,
          alt: pic.alt,
          data: canvas.toDataURL('image/png')
        }));
        this._generateReportHTML(data, arr);
      }, 100);
    }
  },

  /**
   * 生成报告HTML内容（内部方法）
   */
  _generateReportHTML(data, picsArray) {
    const M = Object.fromEntries(picsArray.map(x => [x.key, x]));
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>单摆测重力加速度实验报告</title>
  <style>
    body {
      font-family: "Microsoft YaHei", Arial, sans-serif;
      line-height: 1.6;
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1, h2 {
      color: #2c3e50;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .formula {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 5px;
      margin: 10px 0;
      text-align: center;
      font-style: italic;
    }
    .chart-container {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin: 20px 0;
      flex-wrap: wrap;
    }
    .chart {
      border: 1px solid #ddd;
      padding: 10px;
      border-radius: 5px;
      background: white;
    }
    .question {
      background: #f5f6fa;
      padding: 15px;
      border-left: 4px solid #5d6d7e;
      margin: 10px 0;
    }
    .answer {
      margin-left: 20px;
      color: #2c3e50;
    }
  </style>
</head>
<body>
  <h1>单摆测重力加速度实验报告</h1>
  
  <p>摆测重力加速度伽利略在比萨大教堂内观察一个圣灯缓慢地摆动时，用他的脉搏跳动作为计时器计算圣灯摆动的周期。他发现连续摆动的圣灯，每次摆动的时间间隔是相等的，与圣灯摆动的振幅无关，并用实验证实了观察的结果。这就是单摆的等时性原理。用单摆来测量重力加速度简单方便，因为单摆的振动周期取决于振动系统本身的性质，即取决于重力加速度g和摆长L.只需要测出摆长L和摆动周期T，就可算出g的值。地球上各个地区重力加速度g的数值，随该地区的地理纬度和相对于海平面的高度的不同而稍有差异。</p>

  <h2>【实验目的】</h2>
  <ol>
    <li>掌握用单摆测量重力加速度的方法并分析重力加速度与摆长之间的关系。</li>
    <li>研究单摆的周期与单摆的摆长、摆动角度之间的关系。</li>
    <li>学习用作图法处理测量数据。</li>
  </ol>

  <h2>【实验原理】</h2>
  <p>一根长为L的不可伸长的细线，上端固定，下端悬挂一个质量为m的小球。当细线质量比小球的质量小很多，而且小球的直径又比细线的长度小很多，摆角小于或等于10°,空气阻力不计，此种装置称为单摆。</p>
  
  <p>如果把小球稍微拉开一定距离，小球在重力作用下可在竖直平面内作往复运动，一个完整的往复运动所用的时间称为一个周期。</p>

  <p>可以证明单摆的周期T满足下面公式：</p>
  <div class="formula">
    T = 2π√(L/g)
  </div>

  <p>式中L为单摆摆长。单摆摆长是指上端悬挂点到球心之间的距离，g为重力加速度。如果测量得出周期T，单摆的摆长L，利用上面式子可计算出当地的重力加速度g.从上面公式可知T²和L具有线性关系，对不同的单摆摆长L测量得出相对应的周期，可由线的斜率求出g值。</p>

  <p>当摆动角度θ较大(θ>10°)时，单摆的振动周期T和摆动的角度θ之间存在下列关系：</p>
  <div class="formula">
    T = T₀(1 + (1/16)sin²(θ/2) + ...)
  </div>

  <h2>【实验仪器】</h2>
  <p>单摆实验装置，光电门，米尺，游标卡尺。</p>

  <h2>【数据处理与结果】</h2>
  <h3>实验1：周期与摆长的关系</h3>
  <div class="chart-container">
    <div class="chart">
      <canvas id="chart1" width="400" height="300" style="max-width:400px;width:100%;display:block;margin:8px auto;border:1px solid #ddd;border-radius:6px;background:#fff;"></canvas>
      <p>图1：T vs L 散点图与曲线拟合</p>
    </div>
    <div class="chart">
      <canvas id="chart2" width="400" height="300" style="max-width:400px;width:100%;display:block;margin:8px auto;border:1px solid #ddd;border-radius:6px;background:#fff;"></canvas>
      <p>图2：T vs √L 散点图与线性拟合</p>
    </div>
  </div>

  <div class="question">
    <p><strong>思考题1：</strong>为什么是曲线不是直线？能否找到一种方法，让数据变成线性关系？</p>
    <div class="answer" id="answer1"></div>
  </div>

  <div class="question">
    <p><strong>思考题2：</strong>为什么选择√L？是否有其他方法得到线性？</p>
    <div class="answer" id="answer2"></div>
  </div>

  <h3>实验2：重力加速度与摆长的关系</h3>
  <div class="chart-container">
    <div class="chart">
      <canvas id="chart3" width="400" height="300" style="max-width:400px;width:100%;display:block;margin:8px auto;border:1px solid #ddd;border-radius:6px;background:#fff;"></canvas>
      <p>图3：g vs L 散点图与曲线拟合</p>
    </div>
  </div>

  <div class="question">
    <p><strong>思考题1：</strong>为什么g在小摆长和大摆长时偏小，中摆长时稳定？</p>
    <div class="answer" id="answer4"></div>
  </div>

  <div class="question">
    <p><strong>思考题2：</strong>如何改进实验让重力加速度的测量更精准呢？</p>
    <div class="answer" id="answer6"></div>
  </div>

  <h3>实验3：周期与摆角的关系</h3>
  <div class="chart-container">
    <div class="chart">
      <canvas id="chart4" width="400" height="300" style="max-width:400px;width:100%;display:block;margin:8px auto;border:1px solid #ddd;border-radius:6px;background:#fff;"></canvas>
      <p>图4：小摆角下的周期变化 (1-10°)</p>
    </div>
  </div>

  <div class="question">
    <p><strong>思考题1：</strong>为什么小摆角下得到的图像周期基本不变？</p>
    <div class="answer" id="answer7"></div>
  </div>

  <div class="question">
    <p><strong>思考题2：</strong>为什么大摆角下周期变化幅度这么大？</p>
    <div class="answer" id="answer9"></div>
  </div>

  <h2>【注意事项】</h2>
  <p>单摆必须在竖直面内摆动,防止形成锥摆。</p>

  <h2>【分析讨论题】</h2>
  <div class="question">
    <p><strong>1. </strong>单摆在摆动中受空气阻力的影响,摆幅会越来越小,试问它的周期是否会变化?请根据实验观察进行回答,并说明理论依据。</p>
    <div class="answer"></div>
  </div>

  <div class="question">
    <p><strong>2. </strong>根据间接测量误差传递公式分析本实验中哪个物理量的测量对g测量影响最大?应采用什么方法减小测量误差?</p>
    <div class="answer"></div>
  </div>

  <script>
    // 注入用于绘图的实验数据
    window.experimentData = ${JSON.stringify(data)};

    // 获取学生填写的答案
    function getAnswers() {
      const answers = document.querySelectorAll('textarea');
      answers.forEach((answer, index) => {
        const answerDiv = document.getElementById('answer' + (index + 1));
        if (answerDiv) {
          answerDiv.textContent = answer.value || '（未作答）';
        }
      });
    }

    // 自带的绘图（与可视化分析一致）
    function drawTvsLChartLocal(data, canvas) { const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h); if(!data||data.length===0){ctx.fillStyle='#f0f0f0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#666';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('暂无实验数据',w/2,h/2);return;} const m=60,pw=w-2*m,ph=h-2*m; const Ls=data.map(d=>d.length), Ts=data.map(d=>d.period); const Lmin=Math.min(...Ls),Lmax=Math.max(...Ls),Tmin=Math.min(...Ts),Tmax=Math.max(...Ts); const l0=Math.max(0,Lmin-(Lmax-Lmin)*0.1),l1=Lmax+(Lmax-Lmin)*0.1; const t0=Math.max(0,Tmin-(Tmax-Tmin)*0.1),t1=Tmax+(Tmax-Tmin)*0.1; const dL=l1-l0,dT=t1-t0; ctx.strokeStyle='#f0f0f0';ctx.lineWidth=1; for(let i=0;i<=10;i++){const x=m+(i/10)*pw;ctx.beginPath();ctx.moveTo(x,m);ctx.lineTo(x,h-m);ctx.stroke();} for(let i=0;i<=10;i++){const y=m+(i/10)*ph;ctx.beginPath();ctx.moveTo(m,y);ctx.lineTo(w-m,y);ctx.stroke();} ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m,m);ctx.lineTo(m,h-m);ctx.lineTo(w-m,h-m);ctx.stroke(); ctx.fillStyle='#333';ctx.font='12px Arial';ctx.textAlign='center'; for(let i=0;i<=6;i++){const L=l0+(l1-l0)*i/6; const x=m+(L-l0)/dL*pw; const y=h-m; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+5);ctx.stroke(); ctx.fillText(L.toFixed(1),x,y+20);} for(let i=0;i<=6;i++){const T=t0+(t1-t0)*i/6; const x=m; const y=h-m-(T-t0)/dT*ph; ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x,y);ctx.stroke(); ctx.textAlign='right';ctx.fillText(T.toFixed(2),x-10,y+4);} ctx.fillStyle='#ff6b6b';ctx.strokeStyle='#d32f2f';ctx.lineWidth=1; data.forEach(d=>{const x=m+(d.length-l0)/dL*pw; const y=h-m-(d.period-t0)/dT*ph; ctx.beginPath();ctx.arc(x,y,5,0,2*Math.PI);ctx.fill();ctx.stroke();}); ctx.strokeStyle='#4caf50';ctx.lineWidth=3;ctx.beginPath(); for(let i=0;i<=100;i++){const L=l0+dL*i/100; const T=2*Math.PI*Math.sqrt(L/100/9.8); const x=m+(L-l0)/dL*pw; const y=h-m-(T-t0)/dT*ph; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.stroke(); ctx.fillStyle='#333';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('摆长 L (cm)',w/2,h-15); ctx.save();ctx.translate(15,h/2);ctx.rotate(-Math.PI/2);ctx.fillText('周期 T (s)',0,0);ctx.restore(); }
    function drawTvsSqrtLChartLocal(data, canvas){ const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h); if(!data||data.length===0){ctx.fillStyle='#f0f0f0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#666';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('暂无实验数据',w/2,h/2);return;} const m=60,pw=w-2*m,ph=h-2*m; const Xs=data.map(d=>d.sqrtLength), Ys=data.map(d=>d.period); const xmin=Math.min(...Xs),xmax=Math.max(...Xs),ymin=Math.min(...Ys),ymax=Math.max(...Ys); const x0=Math.max(0,xmin-(xmax-xmin)*0.1),x1=xmax+(xmax-xmin)*0.1; const y0=Math.max(0,ymin-(ymax-ymin)*0.1),y1=ymax+(ymax-ymin)*0.1; const dX=x1-x0,dY=y1-y0; ctx.strokeStyle='#f0f0f0';ctx.lineWidth=1; for(let i=0;i<=10;i++){const x=m+(i/10)*pw;ctx.beginPath();ctx.moveTo(x,m);ctx.lineTo(x,h-m);ctx.stroke();} for(let i=0;i<=10;i++){const y=m+(i/10)*ph;ctx.beginPath();ctx.moveTo(m,y);ctx.lineTo(w-m,y);ctx.stroke();} ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m,m);ctx.lineTo(m,h-m);ctx.lineTo(w-m,h-m);ctx.stroke(); ctx.fillStyle='#333';ctx.font='12px Arial';ctx.textAlign='center'; for(let i=0;i<=6;i++){const X=x0+(x1-x0)*i/6; const x=m+(X-x0)/dX*pw; const y=h-m; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+5);ctx.stroke(); ctx.fillText(X.toFixed(1),x,y+20);} for(let i=0;i<=6;i++){const Y=y0+(y1-y0)*i/6; const x=m; const y=h-m-(Y-y0)/dY*ph; ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x,y);ctx.stroke(); ctx.textAlign='right';ctx.fillText(Y.toFixed(2),x-10,y+4);} ctx.fillStyle='#ff6b6b'; data.forEach(d=>{const x=m+(d.sqrtLength-x0)/dX*pw; const y=h-m-(d.period-y0)/dY*ph; ctx.beginPath();ctx.arc(x,y,4,0,2*Math.PI);ctx.fill();}); ctx.strokeStyle='#4caf50';ctx.lineWidth=2;ctx.beginPath(); for(let i=0;i<=100;i++){const X=x0+dX*i/100; const Y=2*Math.PI/Math.sqrt(9.8)*X/10; const x=m+(X-x0)/dX*pw; const y=h-m-(Y-y0)/dY*ph; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.stroke(); ctx.fillStyle='#333';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('√L (cm^0.5)',w/2,h-15); ctx.save();ctx.translate(15,h/2);ctx.rotate(-Math.PI/2);ctx.fillText('周期 T (s)',0,0);ctx.restore(); }
    function drawGvsLChartLocal(data, canvas){ const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h); const gs=data.map(d=>d.gravity).filter(g=>g!=null); if(gs.length===0){ctx.fillStyle='#f0f0f0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#666';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('暂无重力加速度数据',w/2,h/2);return;} const m=60,pw=w-2*m,ph=h-2*m; const Ls=data.map(d=>d.length); const Lmin=Math.min(...Ls),Lmax=Math.max(...Ls),Gmin=Math.min(...gs),Gmax=Math.max(...gs); const l0=Math.max(0,Lmin-(Lmax-Lmin)*0.1),l1=Lmax+(Lmax-Lmin)*0.1; const g0=Math.max(8,Gmin-(Gmax-Gmin)*0.1),g1=Math.min(12,Gmax+(Gmax-Gmin)*0.1); const dL=l1-l0,dG=g1-g0; ctx.strokeStyle='#f0f0f0';ctx.lineWidth=1; for(let i=0;i<=10;i++){const x=m+(i/10)*pw;ctx.beginPath();ctx.moveTo(x,m);ctx.lineTo(x,h-m);ctx.stroke();} for(let i=0;i<=10;i++){const y=m+(i/10)*ph;ctx.beginPath();ctx.moveTo(m,y);ctx.lineTo(w-m,y);ctx.stroke();} ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m,m);ctx.lineTo(m,h-m);ctx.lineTo(w-m,h-m);ctx.stroke(); ctx.fillStyle='#333';ctx.font='12px Arial';ctx.textAlign='center'; for(let i=0;i<=6;i++){const L=l0+(l1-l0)*i/6; const x=m+(L-l0)/dL*pw; const y=h-m; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+5);ctx.stroke(); ctx.fillText(L.toFixed(0),x,y+20);} for(let i=0;i<=6;i++){const G=g0+(g1-g0)*i/6; const x=m; const y=h-m-(G-g0)/dG*ph; ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x,y);ctx.stroke(); ctx.textAlign='right';ctx.fillText(G.toFixed(2),x-10,y+4);} ctx.fillStyle='#ff6b6b'; data.forEach(d=>{if(d.gravity!=null){const x=m+(d.length-l0)/dL*pw; const y=h-m-(d.gravity-g0)/dG*ph; ctx.beginPath();ctx.arc(x,y,4,0,2*Math.PI);ctx.fill();}}); ctx.strokeStyle='#4caf50';ctx.setLineDash([5,5]);ctx.lineWidth=2; const ref=9.79; const yRef=h-m-(ref-g0)/dG*ph; ctx.beginPath();ctx.moveTo(m,yRef);ctx.lineTo(w-m,yRef);ctx.stroke();ctx.setLineDash([]); ctx.fillStyle='#333';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('摆长 L (cm)',w/2,h-15); ctx.save();ctx.translate(15,h/2);ctx.rotate(-Math.PI/2);ctx.fillText('重力加速度 g (m/s²)',0,0);ctx.restore(); }
    function drawTvsSmallThetaChartLocal(data, canvas){ const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h); if(!data||data.length===0){ctx.fillStyle='#f0f0f0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#666';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('暂无小摆角数据',w/2,h/2);return;} const m=60,pw=w-2*m,ph=h-2*m; const As=data.map(d=>d.initialAngle), Ts=data.map(d=>d.period); const Amin=Math.min(...As),Amax=Math.max(...As),Tmin=Math.min(...Ts),Tmax=Math.max(...Ts); const a0=Math.max(0,Amin-(Amax-Amin)*0.1),a1=Amax+(Amax-Amin)*0.1; const t0=Math.max(0,Tmin-(Tmax-Tmin)*0.1),t1=Tmax+(Tmax-Tmin)*0.1; const dA=a1-a0,dT=t1-t0; ctx.strokeStyle='#f0f0f0';ctx.lineWidth=1; for(let i=0;i<=10;i++){const x=m+(i/10)*pw;ctx.beginPath();ctx.moveTo(x,m);ctx.lineTo(x,h-m);ctx.stroke();} for(let i=0;i<=10;i++){const y=m+(i/10)*ph;ctx.beginPath();ctx.moveTo(m,y);ctx.lineTo(w-m,y);ctx.stroke();} ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m,m);ctx.lineTo(m,h-m);ctx.lineTo(w-m,h-m);ctx.stroke(); ctx.fillStyle='#333';ctx.font='12px Arial';ctx.textAlign='center'; for(let i=0;i<=6;i++){const A=a0+(a1-a0)*i/6; const x=m+(A-a0)/dA*pw; const y=h-m; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+5);ctx.stroke(); ctx.fillText(A.toFixed(1),x,y+20);} for(let i=0;i<=6;i++){const T=t0+(t1-t0)*i/6; const x=m; const y=h-m-(T-t0)/dT*ph; ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x,y);ctx.stroke(); ctx.textAlign='right';ctx.fillText(T.toFixed(2),x-10,y+4);} ctx.fillStyle='#ff6b6b'; data.forEach(d=>{const x=m+(d.initialAngle-a0)/dA*pw; const y=h-m-(d.period-t0)/dT*ph; ctx.beginPath();ctx.arc(x,y,4,0,2*Math.PI);ctx.fill();}); const avg=Ts.reduce((s,v)=>s+v,0)/Ts.length; ctx.strokeStyle='#4caf50';ctx.setLineDash([5,5]);ctx.lineWidth=2; const yRef=h-m-(avg-t0)/dT*ph; ctx.beginPath();ctx.moveTo(m,yRef);ctx.lineTo(w-m,yRef);ctx.stroke();ctx.setLineDash([]); ctx.fillStyle='#333';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('摆角 θ (°)',w/2,h-15); ctx.save();ctx.translate(15,h/2);ctx.rotate(-Math.PI/2);ctx.fillText('周期 T (s)',0,0);ctx.restore(); }

    // 绘制图表
    function drawReportCharts() {
      drawTvsLChartLocal(window.experimentData, document.getElementById('chart1'));
      drawTvsSqrtLChartLocal(window.experimentData, document.getElementById('chart2'));
      drawGvsLChartLocal(window.experimentData, document.getElementById('chart3'));
      drawTvsSmallThetaChartLocal(window.experimentData, document.getElementById('chart4'));
    }

    // 页面加载完成后执行
    window.onload = function() {
      getAnswers();
      drawReportCharts();
    };
  </script>
</body>
</html>`;
 
    // 创建并下载报告
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '单摆测重力加速度实验报告.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * 显示可视化分析界面
   */
  async showVisualizationAnalysis() {
    console.log('showVisualizationAnalysis函数被调用');
    
    // 移除已存在的可视化界面
    const existingModal = document.getElementById('visualizationModal');
    if (existingModal) {
      existingModal.remove();
    }

    // 获取后端配置：是否使用静态图片
    let useStaticCharts = 1; // 默认使用静态图片
    try {
      const response = await fetch('http://127.0.0.1:5000/get_chart_config');
      if (response.ok) {
        const config = await response.json();
        useStaticCharts = (config.use_static_charts ?? 1) === 1 ? 1 : 0;
        console.log('获取到图表配置:', useStaticCharts);
      }
    } catch (e) {
      console.warn('获取图表配置失败，使用默认配置（静态图片）:', e);
    }

    // 获取实验数据
    console.log('准备调用processExperimentData()');
    const data = this.processExperimentData();
    console.log('processExperimentData()返回的数据:', data);
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.id = 'visualizationModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      overflow-y: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 20px;
    `;

    // 创建内容容器
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 15px;
      padding: 30px;
      max-width: 1200px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
      display: flex;
      flex-direction: column;
    `;

    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    closeBtn.style.cssText = `
      position: absolute;
      top: 20px;
      right: 25px;
      background: #ff4757;
      border: none;
      cursor: pointer;
      color: white;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
      font-size: 0;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.transform = 'scale(1.1)';
      closeBtn.style.boxShadow = '0 6px 16px rgba(255, 71, 87, 0.4)';
      closeBtn.style.background = '#ff3742';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.transform = 'scale(1)';
      closeBtn.style.boxShadow = '0 4px 12px rgba(255, 71, 87, 0.3)';
      closeBtn.style.background = '#ff4757';
    };
    closeBtn.onclick = () => modal.remove();

    // 标题
    const title = document.createElement('h1');
    title.textContent = '单摆实验数据分析';
    title.style.cssText = `
      text-align: center;
      color: #333;
      margin-bottom: 20px;
      font-size: 2rem;
      font-weight: bold;
    `;

    // 创建标签页容器
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 30px;
    `;

    // 创建标签页按钮
    const tab1 = document.createElement('button');
    tab1.textContent = '周期与摆长关系';
    const tab2 = document.createElement('button');
    tab2.textContent = '重力加速度与摆长关系';
    const tab3 = document.createElement('button');
    tab3.textContent = '周期与摆角关系';

    const tabStyle = `
      padding: 12px 30px;
      border: none;
      border-radius: 25px;
      cursor: pointer;
      font-size: 1.1rem;
      transition: all 0.3s;
      white-space: nowrap;
      font-weight: 500;
      background: #f0f0f0;
      color: #666;
    `;

    [tab1, tab2, tab3].forEach(tab => {
      tab.style.cssText = tabStyle;
    });

    const setActiveTab = (activeTab) => {
      [tab1, tab2, tab3].forEach(tab => {
        if (tab === activeTab) {
          tab.style.background = '#4caf50';
          tab.style.color = 'white';
          tab.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
        } else {
          tab.style.background = '#f0f0f0';
          tab.style.color = '#666';
          tab.style.boxShadow = 'none';
        }
      });
    };

    // 添加标签页到容器
    tabContainer.appendChild(tab1);
    tabContainer.appendChild(tab2);
    tabContainer.appendChild(tab3);

    // 创建内容容器
    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = `
      flex: 1;
      overflow-y: auto;
    `;

    // 按顺序添加元素
    content.appendChild(closeBtn);
    content.appendChild(title);
    content.appendChild(tabContainer);
    content.appendChild(contentWrapper);

    // 创建三个内容面板
    const content1 = document.createElement('div');
    content1.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 30px;
      margin-top: 20px;
    `;

    // T vs L 图表和问题
    const leftColumn1 = document.createElement('div');
    leftColumn1.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // T vs L 图表容器
    const chart1Container = document.createElement('div');
    chart1Container.style.cssText = `
      border: 2px solid #e0e0e0;
      border-radius: 15px;
      padding: 30px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
    `;

    const chart1Title = document.createElement('h3');
    chart1Title.textContent = 'T vs L 散点图与曲线拟合';
    chart1Title.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      color: #2c3e50;
      font-size: 1.4rem;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(44, 62, 80, 0.1);
    `;

    const chart1Canvas = document.createElement('canvas');
    chart1Canvas.id = 'chart1';
    chart1Canvas.width = 600;
    chart1Canvas.height = 400;
    chart1Canvas.style.cssText = `
      width: 100%;
      max-width: 600px;
      height: auto;
      aspect-ratio: 3/2;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      margin: 0 auto;
      display: block;
    `;
    // 隐藏占位图
    // 根据配置决定显示图片还是canvas
    if (useStaticCharts === 1) {
      chart1Canvas.style.display = 'none';
    } else {
      chart1Canvas.style.display = 'block';
    }

    chart1Container.appendChild(chart1Title);
    chart1Container.appendChild(chart1Canvas);
    // 创建静态图片元素
    const imgTL = document.createElement('img');
    imgTL.src = '可视化分析/T-L曲线拟合.png';
    imgTL.alt = 'T-L曲线拟合';
    if (useStaticCharts === 1) {
      imgTL.style.cssText = 'display:block;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    } else {
      imgTL.style.cssText = 'display:none;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    }
    chart1Container.appendChild(imgTL);
    
    // 如果使用动态图表，绘制数据
    if (useStaticCharts === 0) {
      this.drawTvsLChart(data, chart1Canvas);
    }

    // 问题1 - 美化后的样式
    const question1Container = document.createElement('div');
    question1Container.style.cssText = `
      border: 2px solid #ff6b6b;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const question1Border = document.createElement('div');
    question1Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff6b6b, #ff8a80, #ff6b6b);
    `;
    question1Container.appendChild(question1Border);

    const question1 = document.createElement('p');
    question1.textContent = '为什么是曲线不是直线？能否找到一种方法，让数据变成线性关系？';
    question1.style.cssText = `
      font-weight: 700;
      color: #d32f2f;
      margin-bottom: 20px;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      text-shadow: 0 1px 2px rgba(211, 50, 47, 0.1);
    `;

    const answer1 = document.createElement('textarea');
    answer1.placeholder = '请在这里输入你的思考...';
    answer1.style.cssText = `
      width: calc(100% - 20px);
      min-height: 100px;
      padding: 15px;
      border: 2px solid #ffcdd2;
      border-radius: 10px;
      resize: vertical;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      background: #ffffff;
      color: #333;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    `;

    // 添加输入框焦点效果
    answer1.addEventListener('focus', () => {
      answer1.style.borderColor = '#ff6b6b';
      answer1.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(255, 107, 107, 0.1)';
    });

    answer1.addEventListener('blur', () => {
      answer1.style.borderColor = '#ffcdd2';
      answer1.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)';
    });

    question1Container.appendChild(question1);
    question1Container.appendChild(answer1);

    leftColumn1.appendChild(chart1Container);
    leftColumn1.appendChild(question1Container);

    // T vs √L 图表和问题
    const rightColumn1 = document.createElement('div');
    rightColumn1.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // 理论说明 - 美化后的样式
    const theoryContainer1 = document.createElement('div');
    theoryContainer1.style.cssText = `
      border: 2px solid #4caf50;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #f1f8e9 0%, #e8f5e8 100%);
      box-shadow: 0 4px 15px rgba(76, 175, 80, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const theory1Border = document.createElement('div');
    theory1Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #4caf50, #66bb6a, #4caf50);
    `;
    theoryContainer1.appendChild(theory1Border);

    const theoryText1 = document.createElement('p');
    theoryText1.innerHTML = '<strong>单摆周期公式：</strong>T = 2π√(L/g)<br><br>对L开根号后：T = (2π/√g)·√L，呈线性关系';
    theoryText1.style.cssText = `
      color: #2e7d32;
      font-size: 1.2rem;
      line-height: 1.6;
      text-align: center;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(46, 125, 50, 0.1);
    `;

    theoryContainer1.appendChild(theoryText1);

    // T vs √L 图表容器
    const chart2Container = document.createElement('div');
    chart2Container.style.cssText = `
      border: 2px solid #e0e0e0;
      border-radius: 15px;
      padding: 30px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
    `;

    const chart2Title = document.createElement('h3');
    chart2Title.textContent = 'T vs √L 散点图与线性拟合';
    chart2Title.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      color: #2c3e50;
      font-size: 1.4rem;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(44, 62, 80, 0.1);
    `;

    const chart2Canvas = document.createElement('canvas');
    chart2Canvas.id = 'chart2';
    chart2Canvas.width = 600;
    chart2Canvas.height = 400;
    chart2Canvas.style.cssText = `
      width: 100%;
      max-width: 600px;
      height: auto;
      aspect-ratio: 3/2;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      margin: 0 auto;
    `;
    chart2Canvas.style.display = useStaticCharts === 1 ? 'none' : 'block';

    chart2Container.appendChild(chart2Title);
    chart2Container.appendChild(chart2Canvas);
    // 创建静态图片元素
    const imgSqrt = document.createElement('img');
    imgSqrt.src = '可视化分析/T-根号L直线拟合.png';
    imgSqrt.alt = 'T-根号L直线拟合';
    imgSqrt.style.cssText = useStaticCharts === 1
      ? 'display:block;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;'
      : 'display:none;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    chart2Container.appendChild(imgSqrt);

    // 问题2 - 美化后的样式
    const question2Container = document.createElement('div');
    question2Container.style.cssText = `
      border: 2px solid #ff6b6b;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const question2Border = document.createElement('div');
    question2Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff6b6b, #ff8a80, #ff6b6b);
    `;
    question2Container.appendChild(question2Border);

    const question2 = document.createElement('p');
    question2.textContent = '为什么选择√L？是否有其他方法得到线性？';
    question2.style.cssText = `
      font-weight: 700;
      color: #d32f2f;
      margin-bottom: 20px;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      text-shadow: 0 1px 2px rgba(211, 50, 47, 0.1);
    `;

    const answer2 = document.createElement('textarea');
    answer2.placeholder = '请在这里输入你的思考...';
    answer2.style.cssText = `
      width: calc(100% - 20px);
      min-height: 100px;
      padding: 15px;
      border: 2px solid #ffcdd2;
      border-radius: 10px;
      resize: vertical;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      background: #ffffff;
      color: #333;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    `;

    // 添加输入框焦点效果
    answer2.addEventListener('focus', () => {
      answer2.style.borderColor = '#ff6b6b';
      answer2.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(255, 107, 107, 0.1)';
    });

    answer2.addEventListener('blur', () => {
      answer2.style.borderColor = '#ffcdd2';
      answer2.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)';
    });

    question2Container.appendChild(question2);
    question2Container.appendChild(answer2);

    rightColumn1.appendChild(theoryContainer1);
    rightColumn1.appendChild(chart2Container);
    rightColumn1.appendChild(question2Container);

    // 将所有内容垂直排列，而不是左右分列
    content1.appendChild(leftColumn1);
    content1.appendChild(rightColumn1);

    const content2 = document.createElement('div');
    content2.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 30px;
      margin-top: 20px;
      display: none;
    `;

    // g vs L 图
    const leftColumn2 = document.createElement('div');
    leftColumn2.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // 理论说明 - 美化后的样式
    const theoryContainer2 = document.createElement('div');
    theoryContainer2.style.cssText = `
      border: 2px solid #4caf50;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #f1f8e9 0%, #e8f5e8 100%);
      box-shadow: 0 4px 15px rgba(76, 175, 80, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const theory2Border = document.createElement('div');
    theory2Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #4caf50, #66bb6a, #4caf50);
    `;
    theoryContainer2.appendChild(theory2Border);

    const theoryText2 = document.createElement('p');
    theoryText2.innerHTML = '<strong>重力加速度计算公式：</strong>g = 4π²L/T²<br><br>当地标准重力加速度：9.873 m/s²';
    theoryText2.style.cssText = `
      color: #2e7d32;
      font-size: 1.2rem;
      line-height: 1.6;
      text-align: center;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(46, 125, 50, 0.1);
    `;

    theoryContainer2.appendChild(theoryText2);

    // g vs L 图表容器
    const chart3Container = document.createElement('div');
    chart3Container.style.cssText = `
      border: 2px solid #e0e0e0;
      border-radius: 15px;
      padding: 30px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
    `;

    const chart3Title = document.createElement('h3');
    chart3Title.textContent = 'g vs L 散点图与曲线拟合';
    chart3Title.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      color: #2c3e50;
      font-size: 1.4rem;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(44, 62, 80, 0.1);
    `;

    const chart3Canvas = document.createElement('canvas');
    chart3Canvas.id = 'chart3';
    chart3Canvas.width = 600;
    chart3Canvas.height = 400;
    chart3Canvas.style.cssText = `
      width: 100%;
      max-width: 600px;
      height: auto;
      aspect-ratio: 3/2;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      margin: 0 auto;
      display: block;
    `;
    // 根据配置决定显示图片还是canvas
    if (useStaticCharts === 1) {
      chart3Canvas.style.display = 'none';
    } else {
      chart3Canvas.style.display = 'block';
    }

    chart3Container.appendChild(chart3Title);
    chart3Container.appendChild(chart3Canvas);
    // 创建静态图片元素
    const imgGL = document.createElement('img');
    imgGL.src = '可视化分析/g与L的关系.png';
    imgGL.alt = 'g与L的关系';
    if (useStaticCharts === 1) {
      imgGL.style.cssText = 'display:block;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    } else {
      imgGL.style.cssText = 'display:none;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    }
    chart3Container.appendChild(imgGL);
    
    // 如果使用动态图表，绘制数据
    if (useStaticCharts === 0) {
      this.drawGvsLChart(data, chart3Canvas);
    }

    leftColumn2.appendChild(theoryContainer2);
    leftColumn2.appendChild(chart3Container);

    // 问题和解释 - 竖向排列，每行一个框
    const rightColumn2 = document.createElement('div');
    rightColumn2.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 25px;
      width: 100%;
    `;

    // 误差解释 - 美化后的样式，独占一行
    const errorExplanation = document.createElement('div');
    errorExplanation.style.cssText = `
      border: 2px solid #ff9800;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
      box-shadow: 0 4px 15px rgba(255, 152, 0, 0.15);
      margin: 0;
      position: relative;
      overflow: hidden;
      width: 100%;
    `;

    // 添加装饰性边框
    const errorBorder = document.createElement('div');
    errorBorder.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff9800, #ffb74d, #ff9800);
    `;
    errorExplanation.appendChild(errorBorder);

    const errorText = document.createElement('p');
    errorText.innerHTML = '短摆长下摆速较快，光束覆盖区域的时间差会放大误差。会导致周期有微弱变大会导致重力加速度偏小';
    errorText.style.cssText = `
      color: #e65100;
      font-size: 1.2rem;
      line-height: 1.6;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(230, 81, 0, 0.1);
    `;

    errorExplanation.appendChild(errorText);

    // 问题4 - 美化后的样式，独占一行
    const question4Container = document.createElement('div');
    question4Container.style.cssText = `
      border: 2px solid #ff6b6b;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.15);
      margin: 0;
      position: relative;
      overflow: hidden;
      width: 100%;
    `;

    // 添加装饰性边框
    const question4Border = document.createElement('div');
    question4Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff6b6b, #ff8a80, #ff6b6b);
    `;
    question4Container.appendChild(question4Border);

    const question4 = document.createElement('p');
    question4.textContent = '已知当地的g为9.873，为什么g在小摆长和大摆长时偏小，中摆长时稳定？';
    question4.style.cssText = `
      font-weight: 700;
      color: #d32f2f;
      margin-bottom: 20px;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      text-shadow: 0 1px 2px rgba(211, 50, 47, 0.1);
    `;

    const answer4 = document.createElement('textarea');
    answer4.placeholder = '请在这里输入你的思考...';
    answer4.style.cssText = `
      width: calc(100% - 20px);
      min-height: 100px;
      padding: 15px;
      border: 2px solid #ffcdd2;
      border-radius: 10px;
      resize: vertical;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      background: #ffffff;
      color: #333;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    `;

    // 添加输入框焦点效果
    answer4.addEventListener('focus', () => {
      answer4.style.borderColor = '#ff6b6b';
      answer4.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(255, 107, 107, 0.1)';
    });

    answer4.addEventListener('blur', () => {
      answer4.style.borderColor = '#ffcdd2';
      answer4.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)';
    });

    question4Container.appendChild(question4);
    question4Container.appendChild(answer4);

    // 问题5 - 美化后的样式，独占一行
    const question5Container = document.createElement('div');
    question5Container.style.cssText = `
      border: 2px solid #ff6b6b;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.15);
      margin: 0;
      position: relative;
      overflow: hidden;
      width: 100%;
    `;

    // 添加装饰性边框
    const question5Border = document.createElement('div');
    question5Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff6b6b, #ff8a80, #ff6b6b);
    `;
    question5Container.appendChild(question5Border);

    const question5 = document.createElement('p');
    question5.textContent = '长摆长下阻力更明显，同时摆绳并非完全刚性，在实验过程中会出现微小伸缩，并在长摆长下更明显？';
    question5.style.cssText = `
      font-weight: 700;
      color: #d32f2f;
      margin-bottom: 20px;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      text-shadow: 0 1px 2px rgba(211, 50, 47, 0.1);
    `;

    const answer5 = document.createElement('textarea');
    answer5.placeholder = '请在这里输入你的思考...';
    answer5.style.cssText = `
      width: calc(100% - 20px);
      min-height: 100px;
      padding: 15px;
      border: 2px solid #ffcdd2;
      border-radius: 10px;
      resize: vertical;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      background: #ffffff;
      color: #333;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    `;

    // 添加输入框焦点效果
    answer5.addEventListener('focus', () => {
      answer5.style.borderColor = '#ff6b6b';
      answer5.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(255, 107, 107, 0.1)';
    });

    answer5.addEventListener('blur', () => {
      answer5.style.borderColor = '#ffcdd2';
      answer5.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)';
    });

    question5Container.appendChild(question5);
    question5Container.appendChild(answer5);

    rightColumn2.appendChild(errorExplanation);
    rightColumn2.appendChild(question4Container);
    rightColumn2.appendChild(question5Container);

    // 将所有内容垂直排列，而不是左右分列
    content2.appendChild(leftColumn2);
    content2.appendChild(rightColumn2);

    const content3 = document.createElement('div');
    content3.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 30px;
      margin-top: 20px;
      display: none;
    `;

    // 小摆角分析
    const leftColumn3 = document.createElement('div');
    leftColumn3.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // 小摆角图表容器
    const chart4Container = document.createElement('div');
    chart4Container.style.cssText = `
      border: 2px solid #e0e0e0;
      border-radius: 15px;
      padding: 30px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
    `;

    const chart4Title = document.createElement('h3');
    chart4Title.textContent = '小摆角下的周期变化 (1-10°)';
    chart4Title.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      color: #2c3e50;
      font-size: 1.4rem;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(44, 62, 80, 0.1);
    `;

    const chart4Canvas = document.createElement('canvas');
    chart4Canvas.id = 'chart4';
    chart4Canvas.width = 600;
    chart4Canvas.height = 400;
    chart4Canvas.style.cssText = `
      width: 100%;
      max-width: 600px;
      height: auto;
      aspect-ratio: 3/2;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      margin: 0 auto;
      display: block;
    `;
    // 根据配置决定显示图片还是canvas
    if (useStaticCharts === 1) {
      chart4Canvas.style.display = 'none';
    } else {
      chart4Canvas.style.display = 'block';
    }

    chart4Container.appendChild(chart4Title);
    chart4Container.appendChild(chart4Canvas);
    // 创建静态图片元素
    const imgTheta = document.createElement('img');
    imgTheta.src = '可视化分析/摆角与周期关系.png';
    imgTheta.alt = '摆角与周期关系';
    if (useStaticCharts === 1) {
      imgTheta.style.cssText = 'display:block;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    } else {
      imgTheta.style.cssText = 'display:none;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    }
    chart4Container.appendChild(imgTheta);
    
    // 如果使用动态图表，绘制数据
    if (useStaticCharts === 0) {
      this.drawTvsSmallThetaChart(data, chart4Canvas);
    }

    // 问题7 - 美化后的样式
    const question7Container = document.createElement('div');
    question7Container.style.cssText = `
      border: 2px solid #ff6b6b;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const question7Border = document.createElement('div');
    question7Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff6b6b, #ff8a80, #ff6b6b);
    `;
    question7Container.appendChild(question7Border);

    const question7 = document.createElement('p');
    question7.textContent = '为什么得到的图像周期基本不变？';
    question7.style.cssText = `
      font-weight: 700;
      color: #d32f2f;
      margin-bottom: 20px;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      text-shadow: 0 1px 2px rgba(211, 50, 47, 0.1);
    `;

    const answer7 = document.createElement('textarea');
    answer7.placeholder = '请在这里输入你的思考...';
    answer7.style.cssText = `
      width: calc(100% - 20px);
      min-height: 100px;
      padding: 15px;
      border: 2px solid #ffcdd2;
      border-radius: 10px;
      resize: vertical;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      background: #ffffff;
      color: #333;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    `;

    // 添加输入框焦点效果
    answer7.addEventListener('focus', () => {
      answer7.style.borderColor = '#ff6b6b';
      answer7.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(255, 107, 107, 0.1)';
    });

    answer7.addEventListener('blur', () => {
      answer7.style.borderColor = '#ffcdd2';
      answer7.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)';
    });

    question7Container.appendChild(question7);
    question7Container.appendChild(answer7);

    leftColumn3.appendChild(chart4Container);
    leftColumn3.appendChild(question7Container);

    // 大摆角分析
    const rightColumn3 = document.createElement('div');
    rightColumn3.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // 理论说明 - 美化后的样式
    const theoryContainer3 = document.createElement('div');
    theoryContainer3.style.cssText = `
      border: 2px solid #ff9800;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
      box-shadow: 0 4px 15px rgba(255, 152, 0, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const theory3Border = document.createElement('div');
    theory3Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff9800, #ffb74d, #ff9800);
    `;
    theoryContainer3.appendChild(theory3Border);

    const theoryText3 = document.createElement('p');
    theoryText3.innerHTML = '大摆角下sinθ≠θ<br>单摆不再做简谐运动而是非线性运动，周期也需要进行角度修正。';
    theoryText3.style.cssText = `
      color: #e65100;
      font-size: 1.2rem;
      line-height: 1.6;
      text-align: center;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(230, 81, 0, 0.1);
    `;

    theoryContainer3.appendChild(theoryText3);

    // 只添加理论说明，不添加图表和问题
    rightColumn3.appendChild(theoryContainer3);

    // 将所有内容垂直排列，而不是左右分列
    content3.appendChild(leftColumn3);
    content3.appendChild(rightColumn3);

    // 将内容面板添加到contentWrapper
    contentWrapper.appendChild(content1);
    contentWrapper.appendChild(content2);
    contentWrapper.appendChild(content3);

    // 标签页切换逻辑
    tab1.onclick = () => {
      setActiveTab(tab1);
      content1.style.display = 'flex';
      content2.style.display = 'none';
      content3.style.display = 'none';
    };

    tab2.onclick = () => {
      setActiveTab(tab2);
      content1.style.display = 'none';
      content2.style.display = 'flex';
      content3.style.display = 'none';
    };

    tab3.onclick = () => {
      setActiveTab(tab3);
      content1.style.display = 'none';
      content2.style.display = 'none';
      content3.style.display = 'flex';
    };

    // 设置默认激活的标签页
    setActiveTab(tab1);
    content1.style.display = 'flex';
    content2.style.display = 'none';
    content3.style.display = 'none';

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 绘制图表
    this.drawCharts(data);
  },

  /**
   * 绘制图表
   */
  drawCharts(data) {
    console.log('drawCharts被调用，数据:', data);
    console.log('window.experimentGroups:', window.experimentGroups);
    
    if (!data || data.length === 0) {
      console.log('没有数据，显示提示信息');
      // 如果没有数据，显示提示信息
      const chart1 = document.getElementById('chart1');
      const chart2 = document.getElementById('chart2');
      const chart3 = document.getElementById('chart3');
      const chart4 = document.getElementById('chart4');
      
      if (chart1) {
        const ctx1 = chart1.getContext('2d');
        ctx1.fillStyle = '#f0f0f0';
        ctx1.fillRect(0, 0, chart1.width, chart1.height);
        ctx1.fillStyle = '#666';
        ctx1.font = '16px Arial';
        ctx1.textAlign = 'center';
        ctx1.fillText('暂无实验数据', chart1.width/2, chart1.height/2);
      }
      
      if (chart2) {
        const ctx2 = chart2.getContext('2d');
        ctx2.fillStyle = '#f0f0f0';
        ctx2.fillRect(0, 0, chart2.width, chart2.height);
        ctx2.fillStyle = '#666';
        ctx2.font = '16px Arial';
        ctx2.textAlign = 'center';
        ctx2.fillText('暂无实验数据', chart2.width/2, chart2.height/2);
      }
      
      if (chart3) {
        const ctx3 = chart3.getContext('2d');
        ctx3.fillStyle = '#f0f0f0';
        ctx3.fillRect(0, 0, chart3.width, chart3.height);
        ctx3.fillStyle = '#666';
        ctx3.font = '16px Arial';
        ctx3.textAlign = 'center';
        ctx3.fillText('暂无实验数据', chart3.width/2, chart3.height/2);
      }
      
      if (chart4) {
        const ctx4 = chart4.getContext('2d');
        ctx4.fillStyle = '#f0f0f0';
        ctx4.fillRect(0, 0, chart4.width, chart4.height);
        ctx4.fillStyle = '#666';
        ctx4.font = '16px Arial';
        ctx4.textAlign = 'center';
        ctx4.fillText('暂无小摆角数据', chart4.width/2, chart4.height/2);
      }
      return;
    }

    console.log('开始绘制图表，数据点数量:', data.length);
    console.log('数据示例:', data[0]);

    // 延迟绘制图表，确保DOM元素已准备好
    setTimeout(() => {
      // 绘制第一个图表：T vs L
      this.drawTvsLChart(data);
      
      // 绘制第二个图表：T vs √L
      this.drawTvsSqrtLChart(data);

      // 绘制第三个图表：g vs L
      this.drawGvsLChart(data);

      // 绘制第四个图表：T vs θ
      this.drawTvsSmallThetaChart(data);
    }, 100);
  },

  /**
   * 绘制 T vs L 图表
   */
  drawTvsLChart(data, canvasArg) {
    const canvas = canvasArg || document.getElementById('chart1');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 添加调试信息
    console.log('drawTvsLChart被调用，数据:', data);
    console.log('数据长度:', data.length);
    
    if (!data || data.length === 0) {
      console.log('没有数据，显示提示');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('暂无实验数据', width/2, height/2);
      return;
    }
    
    // 设置边距
    const margin = 60;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 找出数据范围
    const lengths = data.map(d => d.length);
    const periods = data.map(d => d.period);
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);
    const minPeriod = Math.min(...periods);
    const maxPeriod = Math.max(...periods);
    
    console.log('数据范围:', { minLength, maxLength, minPeriod, maxPeriod });
    
    // 设置合理的显示范围，确保从0开始或包含0
    let displayMinLength, displayMaxLength, displayMinPeriod, displayMaxPeriod;
    
    // 摆长范围：从0开始或从最小摆长开始，确保有足够范围
    if (minLength <= 0) {
      displayMinLength = 0;
    } else {
      displayMinLength = Math.max(0, minLength - (maxLength - minLength) * 0.1);
    }
    displayMaxLength = maxLength + (maxLength - minLength) * 0.1;
    
    // 周期范围：从0开始或从最小周期开始
    if (minPeriod <= 0) {
      displayMinPeriod = 0;
    } else {
      displayMinPeriod = Math.max(0, minPeriod - (maxPeriod - minPeriod) * 0.1);
    }
    displayMaxPeriod = maxPeriod + (maxPeriod - minPeriod) * 0.1;
    
    const displayLengthRange = displayMaxLength - displayMinLength;
    const displayPeriodRange = displayMaxPeriod - displayMinPeriod;
    
    // 绘制背景网格
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // 垂直网格线
    for (let i = 0; i <= 10; i++) {
      const x = margin + (i / 10) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
    }
    
    // 水平网格线
    for (let i = 0; i <= 10; i++) {
      const y = margin + (i / 10) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制坐标轴刻度
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const length = displayMinLength + (displayMaxLength - displayMinLength) * i / xTicks;
      const x = margin + (length - displayMinLength) / displayLengthRange * plotWidth;
      const y = height - margin;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
      
      // 绘制刻度标签
      const label = length.toFixed(1);
      ctx.fillText(label, x, y + 20);
    }
    
    // Y轴刻度
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const period = displayMaxPeriod - (displayMaxPeriod - displayMinPeriod) * i / yTicks;
      const x = margin;
      const y = margin + (period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.textAlign = 'right';
      const label = period.toFixed(2);
      ctx.fillText(label, x - 10, y + 4);
    }
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 1;
    data.forEach(d => {
      const x = margin + (d.length - displayMinLength) / displayLengthRange * plotWidth;
      const y = height - margin - (d.period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
    
    // 绘制理论曲线
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const length = displayMinLength + displayLengthRange * i / steps;
      const period = 2 * Math.PI * Math.sqrt(length / 100 / 9.8);
      const x = margin + (length - displayMinLength) / displayLengthRange * plotWidth;
      const y = height - margin - (period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // 添加图例
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    // 散点图例
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(margin + 10, margin + 10, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('实验数据', margin + 20, margin + 15);
    
    // 理论曲线图例
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin + 10, margin + 30);
    ctx.lineTo(margin + 30, margin + 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('理论曲线 T = 2π√(L/g)', margin + 35, margin + 35);
    
    // 坐标轴标签
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('摆长 L (cm)', width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('周期 T (s)', 0, 0);
    ctx.restore();
  },

  /**
   * 绘制 T vs √L 图表
   */
  drawTvsSqrtLChart(data, canvasArg) {
    const canvas = canvasArg || document.getElementById('chart2');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 添加调试信息
    console.log('drawTvsSqrtLChart被调用，数据:', data);
    console.log('数据长度:', data.length);
    
    if (!data || data.length === 0) {
      console.log('没有数据，显示提示');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('暂无实验数据', width/2, height/2);
      return;
    }
    
    // 设置边距
    const margin = 60;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 找出数据范围
    const sqrtLengths = data.map(d => d.sqrtLength);
    const periods = data.map(d => d.period);
    const minSqrtLength = Math.min(...sqrtLengths);
    const maxSqrtLength = Math.max(...sqrtLengths);
    const minPeriod = Math.min(...periods);
    const maxPeriod = Math.max(...periods);
    
    console.log('T vs √L 数据范围:', { minSqrtLength, maxSqrtLength, minPeriod, maxPeriod });
    
    // 设置合理的显示范围，确保从0开始
    let displayMinSqrtLength, displayMaxSqrtLength, displayMinPeriod, displayMaxPeriod;
    
    // √L范围：从0开始或从最小√L开始
    if (minSqrtLength <= 0) {
      displayMinSqrtLength = 0;
    } else {
      displayMinSqrtLength = Math.max(0, minSqrtLength - (maxSqrtLength - minSqrtLength) * 0.1);
    }
    displayMaxSqrtLength = maxSqrtLength + (maxSqrtLength - minSqrtLength) * 0.1;
    
    // 周期范围：从0开始或从最小周期开始
    if (minPeriod <= 0) {
      displayMinPeriod = 0;
    } else {
      displayMinPeriod = Math.max(0, minPeriod - (maxPeriod - minPeriod) * 0.1);
    }
    displayMaxPeriod = maxPeriod + (maxPeriod - minPeriod) * 0.1;
    
    const displaySqrtLengthRange = displayMaxSqrtLength - displayMinSqrtLength;
    const displayPeriodRange = displayMaxPeriod - displayMinPeriod;
    
    // 绘制背景网格
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // 垂直网格线
    for (let i = 0; i <= 10; i++) {
      const x = margin + (i / 10) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
    }
    
    // 水平网格线
    for (let i = 0; i <= 10; i++) {
      const y = margin + (i / 10) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制坐标轴刻度
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const sqrtLength = displayMinSqrtLength + (displayMaxSqrtLength - displayMinSqrtLength) * i / xTicks;
      const x = margin + (sqrtLength - displayMinSqrtLength) / displaySqrtLengthRange * plotWidth;
      const y = height - margin;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.fillText(sqrtLength.toFixed(1), x, y + 20);
    }
    
    // Y轴刻度
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const period = displayMaxPeriod - (displayMaxPeriod - displayMinPeriod) * i / yTicks;
      const x = margin;
      const y = margin + (period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.textAlign = 'right';
      ctx.fillText(period.toFixed(2), x - 10, y + 4);
    }
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 1;
    data.forEach(d => {
      const x = margin + (d.sqrtLength - displayMinSqrtLength) / displaySqrtLengthRange * plotWidth;
      const y = height - margin - (d.period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
    
    // 绘制线性拟合线
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const sqrtLength = displayMinSqrtLength + displaySqrtLengthRange * i / steps;
      const period = 2 * Math.PI / Math.sqrt(9.8) * sqrtLength / 10;
      const x = margin + (sqrtLength - displayMinSqrtLength) / displaySqrtLengthRange * plotWidth;
      const y = height - margin - (period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // 添加图例
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    // 散点图例
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(margin + 10, margin + 10, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('实验数据', margin + 20, margin + 15);
    
    // 线性拟合图例
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin + 10, margin + 30);
    ctx.lineTo(margin + 30, margin + 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('线性拟合 T = (2π/√g)·√L', margin + 35, margin + 35);
    
    // 坐标轴标签
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('√L (cm^0.5)', width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('周期 T (s)', 0, 0);
    ctx.restore();
  },

  /**
   * 绘制 g vs L 图表
   */
  drawGvsLChart(data, canvasArg) {
    const canvas = canvasArg || document.getElementById('chart3');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置边距
    const margin = 60;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 计算重力加速度数据
    const gData = data.map(d => ({
      length: d.length,
      g: d.gravity || 4 * Math.PI * Math.PI * d.length / 100 / (d.period * d.period)
    }));
    
    // 找出数据范围
    const lengths = gData.map(d => d.length);
    const gValues = gData.map(d => d.g);
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);
    const minG = Math.min(...gValues);
    const maxG = Math.max(...gValues);
    
    console.log('g vs L 原始数据范围:', { minLength, maxLength, minG, maxG });
    
    // 设置合理的显示范围
    let displayMinLength, displayMaxLength, displayMinG, displayMaxG;
    
    // 摆长范围：从0开始或从最小摆长开始
    if (minLength <= 0) {
      displayMinLength = 0;
    } else {
      displayMinLength = Math.max(0, minLength - (maxLength - minLength) * 0.1);
    }
    displayMaxLength = maxLength + (maxLength - minLength) * 0.1;
    
    // 重力加速度范围：设置合理的显示范围，确保有足够的差异
    const gRange = maxG - minG;
    if (gRange < 0.1) {
      // 如果g值差异很小，设置一个合理的显示范围
      const centerG = (minG + maxG) / 2;
      displayMinG = centerG - 0.05; // 上下各扩展0.05
      displayMaxG = centerG + 0.05;
    } else {
      // 正常情况下的范围设置
      displayMinG = minG - gRange * 0.1;
      displayMaxG = maxG + gRange * 0.1;
    }
    
    console.log('g vs L 显示范围:', { displayMinLength, displayMaxLength, displayMinG, displayMaxG });
    
    const displayLengthRange = displayMaxLength - displayMinLength;
    const displayGRange = displayMaxG - displayMinG;
    
    // 绘制背景网格
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // 垂直网格线
    for (let i = 0; i <= 10; i++) {
      const x = margin + (i / 10) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
    }
    
    // 水平网格线
    for (let i = 0; i <= 10; i++) {
      const y = margin + (i / 10) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制坐标轴刻度
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const length = displayMinLength + (displayMaxLength - displayMinLength) * i / xTicks;
      const x = margin + (length - displayMinLength) / displayLengthRange * plotWidth;
      const y = height - margin;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.fillText(length.toFixed(0), x, y + 20);
    }
    
    // Y轴刻度
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const g = displayMinG + (displayMaxG - displayMinG) * i / yTicks;
      const x = margin;
      const y = height - margin - (g - displayMinG) / displayGRange * plotHeight;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.textAlign = 'right';
      const label = g.toFixed(2); // 保留2位小数，显示更精确
      ctx.fillText(label, x - 10, y + 4);
    }
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 1;
    gData.forEach(d => {
      const x = margin + (d.length - displayMinLength) / displayLengthRange * plotWidth;
      const y = height - margin - (d.g - displayMinG) / displayGRange * plotHeight;
      
      console.log(`绘制散点: L=${d.length}, g=${d.g}, x=${x}, y=${y}`);
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
    
    // 绘制理论水平线（标准重力加速度）
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const standardG = 9.79;
    const standardY = height - margin - (standardG - displayMinG) / displayGRange * plotHeight;
    ctx.moveTo(margin, standardY);
    ctx.lineTo(width - margin, standardY);
    ctx.stroke();
    

    
    // 添加图例
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    // 散点图例
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(margin + 10, margin + 10, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('实验数据', margin + 20, margin + 15);
    
    // 标准重力加速度图例
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin + 10, margin + 30);
    ctx.lineTo(margin + 30, margin + 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('标准重力加速度 g = 9.79 m/s²', margin + 35, margin + 35);
    

    
    // 坐标轴标签
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('摆长 L (cm)', width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('重力加速度 g (m/s²)', 0, 0);
    ctx.restore();
  },

  /**
   * 绘制 g vs √L 图表
   */
  drawGvsSqrtLChart(data) {
    const canvas = document.getElementById('chart3b');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置边距
    const margin = 50;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 计算重力加速度和√L数据
    const gSqrtLData = data.map(d => ({
      sqrtLength: Math.sqrt(d.length),
      g: 4 * Math.PI * Math.PI * d.length / 100 / (d.period * d.period)
    }));
    
    // 找出数据范围
    const sqrtLengths = gSqrtLData.map(d => d.sqrtLength);
    const gValues = gSqrtLData.map(d => d.g);
    const minSqrtLength = Math.min(...sqrtLengths);
    const maxSqrtLength = Math.max(...sqrtLengths);
    const minG = Math.min(...gValues);
    const maxG = Math.max(...gValues);
    
    // 设置合理的显示范围
    let displayMinSqrtLength, displayMaxSqrtLength, displayMinG, displayMaxG;
    
    // √L范围：从0开始或从最小√L开始
    if (minSqrtLength <= 0) {
      displayMinSqrtLength = 0;
    } else {
      displayMinSqrtLength = Math.max(0, minSqrtLength - (maxSqrtLength - minSqrtLength) * 0.1);
    }
    displayMaxSqrtLength = maxSqrtLength + (maxSqrtLength - minSqrtLength) * 0.1;
    
    // 重力加速度范围
    if (minG <= 0) {
      displayMinG = 0;
    } else {
      displayMinG = Math.max(0, minG - (maxG - minG) * 0.1);
    }
    displayMaxG = maxG + (maxG - minG) * 0.1;
    
    const displaySqrtLengthRange = displayMaxSqrtLength - displayMinSqrtLength;
    const displayGRange = displayMaxG - displayMinG;
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制坐标轴刻度
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度（√L）
    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const sqrtLength = displayMinSqrtLength + (displayMaxSqrtLength - displayMinSqrtLength) * i / xTicks;
      const x = margin + (sqrtLength - displayMinSqrtLength) / displaySqrtLengthRange * plotWidth;
      const y = height - margin;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
      
      // 绘制刻度标签
      const label = sqrtLength.toFixed(1);
      ctx.fillText(label, x, y + 20);
    }
    
    // Y轴刻度（g）
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const g = displayMaxG - (displayMaxG - displayMinG) * i / yTicks;
      const x = margin;
      const y = margin + (g - displayMinG) / displayGRange * plotHeight;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.textAlign = 'right';
      const label = g.toFixed(1);
      ctx.fillText(label, x - 10, y + 4);
    }
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    gSqrtLData.forEach(d => {
      const x = margin + (d.sqrtLength - displayMinSqrtLength) / displaySqrtLengthRange * plotWidth;
      const y = height - margin - (d.g - displayMinG) / displayGRange * plotHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // 绘制理论直线：g = 4π²L/T²，其中T = 2π√(L/g)
    // 代入得：g = 4π²L/(4π²L/g) = g，所以理论上是水平线
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const standardG = 9.873;
    const standardY = height - margin - (standardG - displayMinG) / displayGRange * plotHeight;
    ctx.moveTo(margin, standardY);
    ctx.lineTo(width - margin, standardY);
    ctx.stroke();
    
    // 标签
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('√L (cm^0.5)', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('重力加速度 g (m/s²)', 0, 0);
    ctx.restore();
  },

  /**
   * 绘制小摆角下的 T vs θ 图表
   */
  drawTvsSmallThetaChart(data, canvasArg) {
    const canvas = canvasArg || document.getElementById('chart4');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置边距
    const margin = 60;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 筛选小摆角数据（1-10°）
    const smallAngleData = data.filter(d => d.initialAngle >= 1 && d.initialAngle <= 10);
    
    if (smallAngleData.length === 0) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('暂无小摆角数据', width/2, height/2);
      return;
    }
    
    // 找出数据范围
    const angles = smallAngleData.map(d => d.initialAngle);
    const periods = smallAngleData.map(d => d.period);
    const minAngle = Math.min(...angles);
    const maxAngle = Math.max(...angles);
    const minPeriod = Math.min(...periods);
    const maxPeriod = Math.max(...periods);
    
    // 设置合理的显示范围，确保从0开始
    let displayMinAngle, displayMaxAngle, displayMinPeriod, displayMaxPeriod;
    
    // 角度范围：从0开始到最大角度
    displayMinAngle = 0;
    displayMaxAngle = Math.max(10, maxAngle + (maxAngle - minAngle) * 0.1);
    
    // 周期范围：从0开始或从最小周期开始
    if (minPeriod <= 0) {
      displayMinPeriod = 0;
    } else {
      displayMinPeriod = Math.max(0, minPeriod - (maxPeriod - minPeriod) * 0.1);
    }
    displayMaxPeriod = maxPeriod + (maxPeriod - minPeriod) * 0.1;
    
    const displayAngleRange = displayMaxAngle - displayMinAngle;
    const displayPeriodRange = displayMaxPeriod - displayMinPeriod;
    
    // 绘制背景网格
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // 垂直网格线
    for (let i = 0; i <= 10; i++) {
      const x = margin + (i / 10) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
    }
    
    // 水平网格线
    for (let i = 0; i <= 10; i++) {
      const y = margin + (i / 10) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制坐标轴刻度
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度（角度）
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const angle = displayMinAngle + (displayMaxAngle - displayMinAngle) * i / xTicks;
      const x = margin + (angle - displayMinAngle) / displayAngleRange * plotWidth;
      const y = height - margin;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
      
      // 绘制刻度标签
      const label = angle.toFixed(1);
      ctx.fillText(label, x, y + 20);
    }
    
    // Y轴刻度（周期）
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const period = displayMaxPeriod - (displayMaxPeriod - displayMinPeriod) * i / yTicks;
      const x = margin;
      const y = margin + (period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.textAlign = 'right';
      const label = period.toFixed(2);
      ctx.fillText(label, x - 10, y + 4);
    }
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 1;
    smallAngleData.forEach(d => {
      const x = margin + (d.initialAngle - displayMinAngle) / displayAngleRange * plotWidth;
      const y = height - margin - (d.period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
    
    // 绘制理论水平线（小摆角下周期基本不变）
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const avgPeriod = periods.reduce((a, b) => a + b) / periods.length;
    const avgY = height - margin - (avgPeriod - displayMinPeriod) / displayPeriodRange * plotHeight;
    ctx.moveTo(margin, avgY);
    ctx.lineTo(width - margin, avgY);
    ctx.stroke();
    
    // 添加图例
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    // 散点图例
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(margin + 10, margin + 10, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('实验数据', margin + 20, margin + 15);
    
    // 理论水平线图例
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin + 10, margin + 30);
    ctx.lineTo(margin + 30, margin + 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('平均周期 T = ' + avgPeriod.toFixed(3) + ' s', margin + 35, margin + 35);
    
    // 坐标轴标签
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('摆角 θ (°)', width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('周期 T (s)', 0, 0);
    ctx.restore();
  },

  /**
   * 绘制 T vs θ 图表
   */
  drawTvsLargeThetaChart(data) {
    const canvas = document.getElementById('chart5');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置边距
    const margin = 50;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 筛选大摆角数据（30-90°）
    const largeAngleData = data.filter(d => d.initialAngle >= 30 && d.initialAngle <= 90);
    
    if (largeAngleData.length === 0) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('暂无大摆角数据', width/2, height/2);
      return;
    }
    
    // 计算理论周期T0
    const calculateT0 = (length) => 2 * Math.PI * Math.sqrt(length / 100 / 9.8);
    
    // 处理数据，计算T/T0
    const processedData = largeAngleData.map(d => ({
      angle: d.initialAngle,
      tRatio: d.period / calculateT0(d.length)
    }));
    
    // 找出数据范围
    const angles = processedData.map(d => d.angle);
    const tRatios = processedData.map(d => d.tRatio);
    const minAngle = Math.min(...angles);
    const maxAngle = Math.max(...angles);
    const minRatio = Math.min(...tRatios);
    const maxRatio = Math.max(...tRatios);
    
    // 处理数据范围为零的情况
    const angleRange = maxAngle - minAngle;
    const ratioRange = maxRatio - minRatio;
    
    // 如果角度范围为零，设置一个小的范围来显示点
    const effectiveAngleRange = angleRange === 0 ? 10 : angleRange;
    const effectiveRatioRange = ratioRange === 0 ? 0.2 : ratioRange;
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    processedData.forEach(d => {
      const x = margin + (d.angle - minAngle) / effectiveAngleRange * plotWidth;
      const y = height - margin - (d.tRatio - minRatio) / effectiveRatioRange * plotHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // 绘制参考线 T/T0 = 1（只有当角度范围不为零时才绘制）
    if (angleRange > 0) {
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const refY = height - margin - (1 - minRatio) / ratioRange * plotHeight;
      ctx.moveTo(margin, refY);
      ctx.lineTo(width - margin, refY);
      ctx.stroke();
    }
    
    // 标签
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('摆角 θ (°)', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('T/T₀', 0, 0);
    ctx.restore();
  },

  /**
   * 处理实验数据，返回用于导出/报告的数据结构
   * 依赖全局 experimentGroups
   */
  processExperimentData() {
    console.log('processExperimentData被调用');
    console.log('window.experimentGroups:', window.experimentGroups);
    
    if (!window.experimentGroups || !window.experimentGroups.length) {
      console.log('没有实验数据');
      return [];
    }
    
    const processedData = [];
    window.experimentGroups.forEach((exp, index) => {
      console.log(`处理实验${index + 1}:`, exp);
      if (exp.periods && exp.periods.length > 0) {
        // 过滤掉duration为0的周期数据
        const validPeriods = exp.periods.filter(p => p.duration > 0);
        
        if (validPeriods.length > 0) {
          const avgPeriod = validPeriods.reduce((sum, p) => sum + p.duration, 0) / validPeriods.length;
          const theoreticalPeriod = 2 * Math.PI * Math.sqrt(exp.length / 100 / 9.8);
          const sqrtLength = Math.sqrt(exp.length);
          const linearFit = 2 * Math.PI / Math.sqrt(9.8) * sqrtLength / 10;
          const processedItem = {
            length: exp.length,
            period: avgPeriod,
            theoreticalPeriod,
            sqrtLength,
            linearFit,
            initialAngle: exp.initialAngle || 0, // 添加初始角度字段
            gravity: exp.gravity || null // 添加重力加速度字段
          };
          console.log(`处理后的数据项${index + 1}:`, processedItem);
          processedData.push(processedItem);
        } else {
          console.log(`实验${index + 1}没有有效的周期数据（所有周期duration都为0）`);
        }
      } else {
        console.log(`实验${index + 1}没有周期数据`);
      }
    });
    
    console.log('最终处理的数据:', processedData);
    return processedData;
  }
};

// 添加模块导出调试信息
console.log('ExportModule模块已加载'); 