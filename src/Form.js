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
      <form onSubmit={this.handleSubmit}>
        {!this.props.judgeMode &&
          <label>
            <p>{this.props.question}:</p>
            <input type="text" value={this.state.value} onChange={this.handleChange} />
          </label>
        }
        {this.props.judgeMode &&
          <label>
            <div style={{ marginTop: "10px", marginBottom: "10px" }}>
              <p style={{ display: "inline" }}>{this.props.question}:</p>&nbsp;
              <p style={{ display: "inline", color: "LightSkyBlue" }}>{this.props.answer}</p>
            </div>
            <select value={this.state.value} onChange={this.handleChange}>
              {this.props.players.map((player) => <option key={player} value={player}>{player}</option>)}
            </select>
          </label>
        }
        <input style={{ marginLeft: "12px" }} type="submit" value="Submit" />
      </form>
    );
  }
}

export default Form;
