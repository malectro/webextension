%%raw(`
  import './appl.global.css';
`)

@react.component
let make = () => {
  let (recentTabs, setRecentTabs) =.React.useState(() => 0);

  <div style={ReactDOM.Style.make(
    ~backgroundColor="blue",
    (),
  )}>
    <h1>{"Tabs"->React.string}</h1>
  </div>
};
