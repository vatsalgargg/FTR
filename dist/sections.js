// Progressive enhancements: all original company and service content stays in HTML.
(() => {
  const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node};
  const button=(text)=>{const b=el('button','',text);b.type='button';return b};
  const activate=(buttons,current)=>buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===current)));
  const reveal=node=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('motion-off'))return;node.getAnimations().forEach(a=>a.cancel());node.animate([{opacity:.45,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'})};

  // Company principles act like ports feeding a shared business outcome.
  const principles=[
    ['01','Your requirements','We start with your business needs, your budget and the systems you already use.','INPUT / UNDERSTANDING'],
    ['02','Connected expertise','IT sales, hardware, software integration and ongoing support come together in one team.','SYSTEM / CAPABILITY'],
    ['03','Long-term support','From sourcing to maintenance, we stay focused on quality, cost and delivery.','OUTPUT / DEPENDABILITY']
  ];
  const company=el('div','principle-console');
  const ports=el('div','principle-ports');ports.setAttribute('aria-label','Explore how FTR works');
  const circuit=el('div','principle-circuit');circuit.setAttribute('aria-hidden','true');
  circuit.innerHTML='<i></i><i></i><i></i><span>FTR</span>';
  const readout=el('div','principle-readout');readout.setAttribute('aria-live','polite');
  const code=el('small'),title=el('h3'),copy=el('p');readout.append(code,title,copy);
  const portButtons=principles.map(([num,label],i)=>{const b=button('');b.append(el('small','',num),el('span','',label),el('span','port-light'));b.addEventListener('click',()=>selectPrinciple(i));ports.append(b);return b});
  function selectPrinciple(i){activate(portButtons,portButtons[i]);company.dataset.port=String(i);code.textContent=principles[i][3];title.textContent=principles[i][1];copy.textContent=principles[i][2];reveal(readout)}
  company.append(ports,circuit,readout);document.querySelector('.about-grid').after(company);selectPrinciple(0);

  // Practical scenarios give the dimensional service modules useful depth.
  const scenarios=[
    ['Building or refreshing your workplace?','Bring your equipment requirements, current setup and budget. We help you identify the hardware and software that fit.'],
    ['Working with disconnected systems?','Map the applications and platforms your team relies on. We help you plan how they can work together.'],
    ['Need dependable day-to-day IT support?','Start with the devices, network and systems that keep your workplace running. We help you define the support you need.'],
    ['Planning ongoing maintenance?','Review your hardware, operating systems and support requirements with us to define an appropriate maintenance scope.']
  ];
  document.querySelectorAll('.service-grid article').forEach((card,i)=>{
    const details=el('details','service-brief');const summary=el('summary','','Explore a use case');summary.append(el('span','','+'));
    const body=el('div','brief-body');body.append(el('h4','',scenarios[i][0]),el('p','',scenarios[i][1]));
    const link=el('a','plain-link','DISCUSS THIS SOLUTION ↗');link.href='#contact';body.append(link);details.append(summary,body);card.append(details);
    const label=el('span','module-label',`SYSTEM MODULE / 0${i+1}`);card.querySelector('.service-art').append(label);
    details.addEventListener('toggle',()=>card.classList.toggle('module-open',details.open));
  });

  // Process workbench: select each stage to trace a requirement into support.
  const steps=[...document.querySelectorAll('.steps article')];
  const stepWrap=document.querySelector('.steps');const workbench=el('div','process-workbench');
  const stepRail=el('div','process-rail');stepRail.setAttribute('aria-label','Explore the four stages');
  const stepScreen=el('div','process-screen');stepScreen.setAttribute('aria-live','polite');
  const screenLabel=el('small'),screenTitle=el('h3'),screenCopy=el('p'),output=el('div','process-output');
  const diagram=el('div','process-diagram');diagram.setAttribute('aria-hidden','true');diagram.innerHTML='<i></i><i></i><i></i><i></i><b>FTR</b>';
  stepScreen.append(screenLabel,diagram,screenTitle,screenCopy,output);
  const results=['A clear understanding of the problem.','A solution shaped around your business.','Connected technology, ready to work.','Confidence in the systems you use.'];
  const next=button('NEXT STAGE →');next.className='process-next';let step=0;
  const stageButtons=steps.map((article,i)=>{const b=button('');b.append(el('span','',`0${i+1}`),el('span','',article.querySelector('h3').textContent));b.addEventListener('click',()=>selectStep(i));stepRail.append(b);return b});
  function selectStep(i){step=i;activate(stageButtons,stageButtons[i]);workbench.dataset.stage=String(i);screenLabel.textContent=`THE RESOLUTION PATH / 0${i+1}`;screenTitle.textContent=steps[i].querySelector('h3').textContent;screenCopy.textContent=steps[i].querySelector('p').textContent;output.replaceChildren(el('small','','THE OUTCOME'),el('span','',results[i]));next.textContent=i===3?'BACK TO START ↺':'NEXT STAGE →';reveal(screenTitle);reveal(screenCopy)}
  next.addEventListener('click',()=>selectStep((step+1)%4));workbench.append(stepRail,stepScreen,next);stepWrap.before(workbench);stepWrap.hidden=true;selectStep(0);

  // A chronological switchboard keeps every milestone within a single viewport.
  const timeline=document.querySelector('.timeline');const milestones=[...timeline.querySelectorAll('article')];
  const archive=el('div','journey-console'),years=el('div','journey-years');years.setAttribute('aria-label','Choose a company milestone');
  const stage=el('div','journey-stage');stage.setAttribute('aria-live','polite');
  const year=el('div','journey-year'),story=el('div','journey-story');const yearLabel=el('small','','FTR / COMPANY ARCHIVE'),yearValue=el('b');year.append(yearLabel,yearValue);
  const milestoneLabel=el('small'),milestoneTitle=el('h3'),milestoneCopy=el('p');story.append(milestoneLabel,milestoneTitle,milestoneCopy);
  const route=el('div','journey-route');route.setAttribute('aria-hidden','true');route.innerHTML='<span></span><span></span><span></span><i></i><b>CONTINUING FORWARD</b>';
  stage.append(year,story,route);let current=0;
  const yearButtons=milestones.map((article,i)=>{const b=button(article.querySelector('b').textContent);b.addEventListener('click',()=>selectYear(i));years.append(b);return b});
  const journeyControls=el('div','journey-controls'),prev=button('← Previous'),counter=el('span'),forward=button('Next →');journeyControls.append(prev,counter,forward);
  function selectYear(i){current=i;activate(yearButtons,yearButtons[i]);yearValue.textContent=milestones[i].querySelector('b').textContent;milestoneLabel.textContent=`MILESTONE / 0${i+1}`;milestoneTitle.textContent=milestones[i].querySelector('h3').textContent;milestoneCopy.textContent=milestones[i].querySelector('p').textContent;counter.textContent=`0${i+1} / 06`;prev.disabled=i===0;forward.disabled=i===5;archive.style.setProperty('--journey-progress',String(i/5));reveal(story)}
  prev.addEventListener('click',()=>selectYear(current-1));forward.addEventListener('click',()=>selectYear(current+1));archive.append(years,stage,journeyControls);timeline.before(archive);timeline.hidden=true;selectYear(0);

  // Real partner identities, with one selected connection instead of decorative noise.
  const partners=document.querySelector('.partner-grid');const partnerReadout=el('div','partner-readout');partnerReadout.setAttribute('aria-live','polite');
  partnerReadout.append(el('small','','PREVIOUSLY WORKED WITH'),el('span','','Select a logo to explore our company profile.'));
  const logoButtons=[...partners.children].map((tile,i)=>{const img=tile.querySelector('img'),b=button('');b.className='partner-tile';b.setAttribute('aria-label',img.alt);b.setAttribute('aria-pressed','false');b.append(el('small','partner-number',String(i+1).padStart(2,'0')),img,el('span','partner-name',img.alt));tile.replaceWith(b);b.addEventListener('click',()=>{activate(logoButtons,b);partnerReadout.lastElementChild.textContent=img.alt+' / Featured in the FTR company profile.'});return b});partners.after(partnerReadout);

  // Scope the conversation before opening the visitor's mail application.
  const contact=document.querySelector('.contact .section-pad');const cta=contact.querySelector('.pill');
  const composer=el('div','contact-composer'),topics=el('div','contact-topics');topics.setAttribute('aria-label','Select a topic for your enquiry');
  composer.append(el('small','','WHAT CAN WE HELP YOU CONNECT?'),topics);
  const subject=el('p','contact-subject','Choose a starting point. We’ll take it from there.');subject.setAttribute('aria-live','polite');composer.append(subject);
  const choices=['IT infrastructure','Systems integration','IT support','Maintenance'];
  const topicButtons=choices.map(label=>{const b=button(label+' ↗');b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{activate(topicButtons,b);subject.textContent='Let’s talk about '+label.toLowerCase()+'.';cta.href='mailto:laxman@ftresolver.com?subject='+encodeURIComponent('FTR enquiry: '+label)});topics.append(b);return b});cta.before(composer);
})();
