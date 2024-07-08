import './App.css';
import Quiz          from 'react-quiz-component';
import { questions } from './questions';

function App() {
  return <Quiz quiz={ questions } shuffle={ true } enableProgressBar={ true } showInstantFeedback={ true }/>
}

export default App;
