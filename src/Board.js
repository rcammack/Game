import React from 'react';
import Form from './Form';

class Board extends React.Component {

  // Create the 3 x 3 board
  createBoard(row) {
    const board = [];
    let cellCounter = 0;

    for (let i = 0; i < row; i += 1) {
      const columns = [];
      columns.push(this.renderSquare(cellCounter++));
      board.push(<div key={i}>{columns}</div>);
    }

    return board;
  }

  renderSquare(i) {
    return (
      <div style={{ marginBottom: "10px"}} key={i}>
        {((this.props.answers[i] === "" && !this.props.roundDone) || this.props.judgeMode) &&
          <Form
            judgeMode={this.props.judgeMode}
            players={this.props.players}
            question={this.props.questions[i]}
            answer={this.props.answers[i]}
            onClick={(value) => this.props.onClick(i, value)} />
        }
        {((this.props.answers[i] !== "" && !this.props.judgeMode) || (this.props.roundDone && !this.props.judgeMode)) &&
          <div>
            <p style={{ display: "inline" }}>{this.props.questions[i]}:</p>&nbsp;
          <p style={{ display: "inline", color: "CornflowerBlue" }}>{this.props.answers[i]}</p>
          </div>
        }
      </div>
    );
  }

  render() {
    return <div>{this.createBoard(this.props.blanks)}</div>;
  }
}

export default Board;
