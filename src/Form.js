import React from 'react';

class Form extends React.Component {
  constructor(props) {
    super(props);
    this.state = { value: this.props.judgeMode ? this.props.players[0] : "" };

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
  }

  handleSubmit(event) {
    event.preventDefault();
    this.props.onClick(this.state.value);
    this.setState({ value: this.props.judgeMode ? this.props.players[0] : "" });
  }

  render() {
    return (
      <div>
        {!this.props.judgeMode &&
          <form className="ui form" onSubmit={this.handleSubmit}>
            <div className="field">
              <label>
                {this.props.refresh && <i style={{ display: "inline", color: "#40A4DB" }} className="redo icon" onClick={() => this.props.onQuestionRefresh()}></i>}&nbsp;
                {this.props.question}:
              </label>
              <div className="ui action input" style={{ maxWidth: "500px" }}>
                <input className="ui input" type="text" placeholder="answer" value={this.state.value} onChange={this.handleChange} />
                <button className="ui button" style={{ backgroundColor: this.props.color }} value="Submit">Submit</button>
              </div>
            </div>
          </form>
        }
        {this.props.judgeMode &&
          <form className="ui form" onSubmit={this.handleSubmit}>
            <label style={{ marginTop: "10px", marginBottom: "10px" }}>
              <p style={{ display: "inline", fontWeight: "bold" }}>{this.props.question}:</p>&nbsp;
                  <p style={{ display: "inline", fontWeight: "bold", color: "#40A4DB" }}>{this.props.answer}</p>
            </label>
            <div className="inline fields">
              <div className="field">
                <select className="ui selection dropdown" value={this.state.value} onChange={this.handleChange}>
                  {this.props.players.map((player) => <option key={player} value={player}>{player}</option>)}
                </select>
              </div>
              <div className="field">
                <input className="ui button" style={{ backgroundColor: this.props.color }} type="submit" value="Submit" />
              </div>
            </div>
          </form>
        }
      </div>
    );
  }
}

export default Form;
