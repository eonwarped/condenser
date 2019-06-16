import { List } from 'immutable';
import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Slider from 'react-rangeslider';
import tt from 'counterpart';
import CloseButton from 'app/components/elements/CloseButton';
import * as transactionActions from 'app/redux/TransactionReducer';
import Icon from 'app/components/elements/Icon';
import {
    DEBT_TOKEN_SHORT,
    LIQUID_TOKEN_UPPERCASE,
    INVEST_TOKEN_SHORT,
    SCOT_DENOM,
    VOTE_WEIGHT_DROPDOWN_THRESHOLD,
} from 'app/client_config';
import FormattedAsset from 'app/components/elements/FormattedAsset';
import { pricePerSteem } from 'app/utils/StateFunctions';
import shouldComponentUpdate from 'app/utils/shouldComponentUpdate';
import {
    formatDecimal,
    parsePayoutAmount,
} from 'app/utils/ParsersAndFormatters';
import DropdownMenu from 'app/components/elements/DropdownMenu';
import TimeAgoWrapper from 'app/components/elements/TimeAgoWrapper';
import Dropdown from 'app/components/elements/Dropdown';

const ABOUT_FLAG = (
    <div>
        <p>
            Downvoting a post can decrease pending rewards and make it less
            visible. Common reasons:
        </p>
        <ul>
            <li>Disagreement on rewards</li>
            <li>Fraud or plagiarism</li>
            <li>Hate speech or trolling</li>
            <li>Miscategorized content or spam</li>
        </ul>
    </div>
);

const MAX_VOTES_DISPLAY = 20;
const VOTE_WEIGHT_DROPDOWN_THRESHOLD_RSHARES = 1.0 * 1000.0 * 1000.0;
const MAX_WEIGHT = 10000;
const SBD_PRINT_RATE_MAX = 10000;

class Voting extends React.Component {
    static propTypes = {
        // HTML properties
        post: PropTypes.string.isRequired,
        showList: PropTypes.bool,

        // Redux connect properties
        vote: PropTypes.func.isRequired,
        author: PropTypes.string, // post was deleted
        permlink: PropTypes.string,
        username: PropTypes.string,
        is_comment: PropTypes.bool,
        active_votes: PropTypes.object,
        loggedin: PropTypes.bool,
        post_obj: PropTypes.object,
        enable_slider: PropTypes.bool,
        voting: PropTypes.bool,
        scotData: PropTypes.object,
    };

    static defaultProps = {
        showList: true,
    };

    constructor(props) {
        super(props);
        this.state = {
            showWeight: false,
            myVote: null,
            sliderWeight: {
                up: MAX_WEIGHT,
                down: MAX_WEIGHT,
            },
        };

        this.voteUp = e => {
            e && e.preventDefault();
            this.voteUpOrDown(true);
        };
        this.voteDown = e => {
            e && e.preventDefault();
            this.voteUpOrDown(false);
        };
        this.voteUpOrDown = up => {
            if (this.props.voting) return;
            this.setState({ votingUp: up, votingDown: !up });
            if (this.state.showWeight) this.setState({ showWeight: false });
            const { myVote } = this.state;
            const { author, permlink, username, is_comment } = this.props;

            let weight;
            if (myVote > 0 || myVote < 0) {
                // if there is a current vote, we're clearing it
                weight = 0;
            } else if (this.props.enable_slider) {
                // if slider is enabled, read its value
                weight = up
                    ? this.state.sliderWeight.up
                    : -this.state.sliderWeight.down;
            } else {
                // otherwise, use max power
                weight = up ? MAX_WEIGHT : -MAX_WEIGHT;
            }

            const isFlag = up ? null : true;
            this.props.vote(weight, {
                author,
                permlink,
                username,
                myVote,
                isFlag,
            });
        };

        this.handleWeightChange = up => weight => {
            let w;
            if (up) {
                w = {
                    up: weight,
                    down: this.state.sliderWeight.down,
                };
            } else {
                w = {
                    up: this.state.sliderWeight.up,
                    down: weight,
                };
            }
            this.setState({ sliderWeight: w });
        };

        this.storeSliderWeight = up => () => {
            const { username, is_comment } = this.props;
            const weight = up
                ? this.state.sliderWeight.up
                : this.state.sliderWeight.down;
            localStorage.setItem(
                'voteWeight' +
                    (up ? '' : 'Down') +
                    '-' +
                    username +
                    (is_comment ? '-comment' : ''),
                weight
            );
        };
        this.readSliderWeight = () => {
            const { username, enable_slider, is_comment } = this.props;
            if (enable_slider) {
                const sliderWeightUp = Number(
                    localStorage.getItem(
                        'voteWeight' +
                            '-' +
                            username +
                            (is_comment ? '-comment' : '')
                    )
                );
                const sliderWeightDown = Number(
                    localStorage.getItem(
                        'voteWeight' +
                            'Down' +
                            '-' +
                            username +
                            (is_comment ? '-comment' : '')
                    )
                );
                this.setState({
                    sliderWeight: {
                        up: sliderWeightUp ? sliderWeightUp : MAX_WEIGHT,
                        down: sliderWeightDown ? sliderWeightDown : MAX_WEIGHT,
                    },
                });
            }
        };

        this.toggleWeightUp = e => {
            e.preventDefault();
            this.toggleWeightUpOrDown(true);
        };

        this.toggleWeightDown = e => {
            e && e.preventDefault();
            this.toggleWeightUpOrDown(false);
        };

        this.toggleWeightUpOrDown = up => {
            this.setState({
                showWeight: !this.state.showWeight,
                showWeightDir: up ? 'up' : 'down',
            });
        };
        this.shouldComponentUpdate = shouldComponentUpdate(this, 'Voting');
    }

    componentWillMount() {
        const { username, active_votes } = this.props;
        this._checkMyVote(username, active_votes);
    }

    componentWillReceiveProps(nextProps) {
        const { username, active_votes } = nextProps;
        this._checkMyVote(username, active_votes);
    }

    _checkMyVote(username, active_votes) {
        if (username && active_votes) {
            const vote = active_votes.find(el => el.get('voter') === username);
            // weight warning, the API may send a string or a number (when zero)
            if (vote)
                this.setState({
                    myVote: parseInt(vote.get('percent') || 0, 10),
                });
        }
    }

    _processScotData(scotData, processedScotData) {
        processedScotData.pending_token = parseInt(
            scotData.get('pending_token')
        );
        processedScotData.total_curator_payout = parseInt(
            scotData.get('curator_payout_value')
        );
        processedScotData.total_author_payout = parseInt(
            scotData.get('total_payout_value')
        );
        const scot_bene_payout = parseInt(
            scotData.get('beneficiaries_payout_value')
        );
        processedScotData.promoted = parseInt(scotData.get('promoted'));
        processedScotData.total_author_payout -=
            processedScotData.total_curator_payout;
        processedScotData.total_author_payout -= scot_bene_payout;
        processedScotData.cashout_time = scotData.get('cashout_time');
        if (
            processedScotData.cashout_time &&
            /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(
                processedScotData.cashout_time
            )
        ) {
            processedScotData.cashout_time =
                processedScotData.cashout_time + 'Z'; // Firefox really wants this Z (Zulu)
        }
        processedScotData.payout = processedScotData.pending_token
            ? processedScotData.pending_token
            : processedScotData.total_author_payout +
              processedScotData.total_curator_payout;

        // divide by SCOT_DENOM
        processedScotData.pending_token /= SCOT_DENOM;
        processedScotData.total_curator_payout /= SCOT_DENOM;
        processedScotData.total_author_payout /= SCOT_DENOM;
        processedScotData.payout /= SCOT_DENOM;
        processedScotData.promoted /= SCOT_DENOM;
    }

    render() {
        const {
            active_votes,
            showList,
            voting,
            enable_slider,
            is_comment,
            post_obj,
            username,
            votingData,
            scotData,
            price_per_steem,
            sbd_print_rate,
        } = this.props;

        // Incorporate 5 day regeneration time.
        const currentVp = votingData
            ? Math.min(
                  votingData.get('voting_power') +
                      (new Date() -
                          Date.parse(votingData.get('last_vote_time'))) *
                          10000 /
                          (1000 * 60 * 60 * 24 * 5),
                  10000
              ) / 100
            : 0;
        const {
            votingUp,
            votingDown,
            showWeight,
            showWeightDir,
            myVote,
        } = this.state;

        const votingUpActive = voting && votingUp;
        const votingDownActive = voting && votingDown;

        const slider = up => {
            const b = up
                ? this.state.sliderWeight.up
                : this.state.sliderWeight.down;
            const s = up ? '' : '-';
            return (
                <span>
                    <div className="weight-display">{s + b / 100}%</div>
                    <Slider
                        min={100}
                        max={MAX_WEIGHT}
                        step={100}
                        value={b}
                        onChange={this.handleWeightChange(up)}
                        onChangeComplete={this.storeSliderWeight(up)}
                        tooltip={false}
                    />
                    {currentVp ? (
                        <div className="voting-power-display">
                            Voting Power: {currentVp.toFixed(1)}%
                        </div>
                    ) : (
                        ''
                    )}
                </span>
            );
        };

        let downVote;
        if (true) {
            const down = (
                <Icon
                    name={votingDownActive ? 'empty' : 'chevron-down-circle'}
                    className="flag"
                />
            );
            const classDown =
                'Voting__button Voting__button-down' +
                (myVote < 0 ? ' Voting__button--downvoted' : '') +
                (votingDownActive ? ' votingDown' : '');
            // myVote === current vote

            const invokeFlag = (
                <span
                    href="#"
                    onClick={this.toggleWeightDown}
                    title="Downvote"
                    id="downvote_button"
                    className="flag"
                >
                    {down}
                </span>
            );

            const revokeFlag = (
                <a
                    href="#"
                    onClick={this.voteDown}
                    title="Downvote"
                    className="flag"
                    id="revoke_downvote_button"
                >
                    {down}
                </a>
            );

            const dropdown = (
                <Dropdown
                    show={showWeight && showWeightDir == 'down'}
                    onHide={() => this.setState({ showWeight: false })}
                    onShow={() => {
                        this.setState({ showWeight: true });
                        this.readSliderWeight();
                    }}
                    title={invokeFlag}
                    position={'right'}
                >
                    <div className="Voting__adjust_weight_down">
                        {(myVote == null || myVote === 0) &&
                            enable_slider && (
                                <div className="weight-container">
                                    {slider(false)}
                                </div>
                            )}
                        <CloseButton
                            onClick={() => this.setState({ showWeight: false })}
                        />
                        <div className="clear Voting__about-flag">
                            {ABOUT_FLAG}
                            <br />
                            <span
                                href="#"
                                onClick={this.voteDown}
                                className="button outline"
                                title="Downvote"
                            >
                                Submit
                            </span>
                        </div>
                    </div>
                </Dropdown>
            );

            downVote = (
                <span className={classDown}>
                    {myVote === null || myVote === 0 ? dropdown : revokeFlag}
                </span>
            );
        }

        const processedScotData = {
            pending_token: 0,
            total_author_payout: 0,
            total_curator_payout: 0,
            payout: 0,
            promoted: 0,
            // Arbitrary invalid cash time (steem related behavior)
            cashout_time: '1969-12-31T23:59:59',
        };
        const processedSteemData = {
            pending_token: 0,
            total_author_payout: 0,
            total_curator_payout: 0,
            payout: 0,
            promoted: 0,
            // Arbitrary invalid cash time (steem related behavior)
            cashout_time: '1969-12-31T23:59:59',
        };
        if (scotData) {
            this._processScotData(
                scotData.get(LIQUID_TOKEN_UPPERCASE),
                processedScotData
            );
            console.log(scotData.toJS());
            if (scotData.has('STEEM')) {
                const steemData = scotData.get('STEEM');
                processedSteemData.cashout_time = steemData.get('cashout_time');
                processedSteemData.max_accepted_payout = parsePayoutAmount(
                    steemData.get('max_accepted_payout')
                );
                processedSteemData.pending_payout = parsePayoutAmount(
                    steemData.get('pending_payout_value')
                );
                const percent_steem_dollars =
                    steemData.get('percent_steem_dollars') / 20000;
                processedSteemData.pending_payout_sbd =
                    processedSteemData.pending_payout * percent_steem_dollars;
                processedSteemData.pending_payout_sp =
                    (processedSteemData.pending_payout -
                        processedSteemData.pending_payout_sbd) /
                    price_per_steem;
                processedSteemData.pending_payout_printed_sbd =
                    processedSteemData.pending_payout_sbd *
                    (sbd_print_rate / SBD_PRINT_RATE_MAX);
                processedSteemData.pending_payout_printed_steem =
                    (processedSteemData.pending_payout_sbd -
                        processedSteemData.pending_payout_printed_sbd) /
                    price_per_steem;
                processedSteemData.total_author_payout = parsePayoutAmount(
                    steemData.get('total_payout_value')
                );
                processedSteemData.total_curator_payout = parsePayoutAmount(
                    steemData.get('curator_payout_value')
                );
                processedSteemData.payout =
                    processedSteemData.pending_payout +
                    processedSteemData.total_author_payout +
                    processedSteemData.total_curator_payout;
                if (processedSteemData.payout < 0.0)
                    processedSteemData.payout = 0.0;
                if (
                    processedSteemData.payout >
                    processedSteemData.max_accepted_payout
                )
                    processedSteemDatapayout =
                        processedSteemData.max_accepted_payout;
            }
        }
        const total_votes = post_obj.getIn(['stats', 'total_votes']);

        if (processedScotData.payout < 0.0) processedScotData.payout = 0.0;

        const up = (
            <Icon
                name={votingUpActive ? 'empty' : 'chevron-up-circle'}
                className="upvote"
            />
        );
        const classUp =
            'Voting__button Voting__button-up' +
            (myVote > 0 ? ' Voting__button--upvoted' : '') +
            (votingUpActive ? ' votingUp' : '');

        // There is an "active cashout" if: (a) there is a pending payout, OR (b) there is a valid cashout_time AND it's NOT a comment with 0 votes.
        const scot_cashout_active =
            processedScotData.pending_token > 0 ||
            (new Date(processedScotData.cashout_time) > Date.now() &&
                !(is_comment && total_votes == 0));
        const steem_cashout_active =
            processedSteemData.pending_payout > 0 ||
            (processedSteemData.cashout_time.indexOf('1969') !== 0 &&
                !(is_comment && total_votes == 0));
        const payoutItems = [];
        const numDecimals = Math.log10(SCOT_DENOM);

        if (processedScotData.promoted > 0) {
            payoutItems.push({
                value: `Promotion Cost ${processedScotData.promoted.toFixed(
                    numDecimals
                )} ${LIQUID_TOKEN_UPPERCASE}`,
            });
        }
        if (scot_cashout_active) {
            payoutItems.push({ value: 'Pending Payout' });
            payoutItems.push({
                value: `${processedScotData.pending_token.toFixed(
                    numDecimals
                )} ${LIQUID_TOKEN_UPPERCASE}`,
            });
            payoutItems.push({
                value: <TimeAgoWrapper date={processedScotData.cashout_time} />,
            });
        } else if (processedScotData.total_author_payout) {
            payoutItems.push({
                value: `Past Token Payouts ${processedScotData.payout.toFixed(
                    numDecimals
                )} ${LIQUID_TOKEN_UPPERCASE}`,
            });
            payoutItems.push({
                value: `- Author ${processedScotData.total_author_payout.toFixed(
                    numDecimals
                )} ${LIQUID_TOKEN_UPPERCASE}`,
            });
            payoutItems.push({
                value: `- Curator ${processedScotData.total_curator_payout.toFixed(
                    numDecimals
                )} ${LIQUID_TOKEN_UPPERCASE}`,
            });
        }
        if (steem_cashout_active) {
            payoutItems.push({
                value: tt('voting_jsx.pending_payout', {
                    value: formatDecimal(
                        processedSteemData.pending_payout
                    ).join(''),
                }),
            });
            if (processedSteemData.max_accepted_payout > 0) {
                payoutItems.push({
                    value:
                        '(' +
                        formatDecimal(
                            processedSteemData.pending_payout_printed_sbd
                        ).join('') +
                        ' ' +
                        DEBT_TOKEN_SHORT +
                        ', ' +
                        (sbd_print_rate != SBD_PRINT_RATE_MAX
                            ? formatDecimal(
                                  processedSteemData.pending_payout_printed_steem
                              ).join('') +
                              ' ' +
                              LIQUID_TOKEN_UPPERCASE +
                              ', '
                            : '') +
                        formatDecimal(
                            processedSteemData.pending_payout_sp
                        ).join('') +
                        ' ' +
                        INVEST_TOKEN_SHORT +
                        ')',
                });
            }
            payoutItems.push({
                value: (
                    <TimeAgoWrapper date={processedSteemData.cashout_time} />
                ),
            });
        } else if (processedSteemData.total_author_payout > 0) {
            payoutItems.push({
                value: tt('voting_jsx.past_payouts', {
                    value: formatDecimal(
                        processedSteemData.total_author_payout +
                            processedSteemData.total_curator_payout
                    ).join(''),
                }),
            });
            payoutItems.push({
                value: tt('voting_jsx.past_payouts_author', {
                    value: formatDecimal(
                        processedSteemData.total_author_payout
                    ).join(''),
                }),
            });
            payoutItems.push({
                value: tt('voting_jsx.past_payouts_curators', {
                    value: formatDecimal(
                        processedSteemData.total_curator_payout
                    ).join(''),
                }),
            });
        }

        const payoutEl = (
            <DropdownMenu el="div" items={payoutItems}>
                <span>
                    <FormattedAsset
                        amount={processedScotData.payout}
                        asset={LIQUID_TOKEN_UPPERCASE}
                    />
                    {payoutItems.length > 0 && <Icon name="dropdown-arrow" />}
                </span>
            </DropdownMenu>
        );

        let voters_list = null;
        if (showList && total_votes > 0 && active_votes) {
            const avotes = active_votes.toJS();
            avotes.sort(
                (a, b) =>
                    Math.abs(parseInt(a.rshares)) >
                    Math.abs(parseInt(b.rshares))
                        ? -1
                        : 1
            );
            let voters = [];
            for (
                let v = 0;
                v < avotes.length && voters.length < MAX_VOTES_DISPLAY;
                ++v
            ) {
                const { percent, voter } = avotes[v];
                const sign = Math.sign(percent);
                if (sign === 0) continue;
                voters.push({
                    value: (sign > 0 ? '+ ' : '- ') + voter,
                    link: '/@' + voter,
                });
            }
            if (total_votes > voters.length) {
                voters.push({
                    value: (
                        <span>
                            &hellip;{' '}
                            {tt('voting_jsx.and_more', {
                                count: total_votes - voters.length,
                            })}
                        </span>
                    ),
                });
            }
            voters_list = (
                <DropdownMenu
                    selected={tt('voting_jsx.votes_plural', {
                        count: total_votes,
                    })}
                    className="Voting__voters_list"
                    items={voters}
                    el="div"
                />
            );
        }

        let voteUpClick = this.voteUp;
        let dropdown = null;
        let voteChevron = votingUpActive ? (
            up
        ) : (
            <a
                href="#"
                onClick={voteUpClick}
                title={myVote > 0 ? tt('g.remove_vote') : tt('g.upvote')}
                id="upvote_button"
            >
                {up}
            </a>
        );
        if (myVote <= 0 && enable_slider) {
            voteUpClick = this.toggleWeightUp;
            voteChevron = null;
            // Vote weight adjust
            dropdown = (
                <Dropdown
                    show={showWeight && showWeightDir == 'up'}
                    onHide={() => this.setState({ showWeight: false })}
                    onShow={() => {
                        this.setState({
                            showWeight: true,
                            showWeightDir: 'up',
                        });
                        this.readSliderWeight();
                    }}
                    title={up}
                >
                    <div className="Voting__adjust_weight">
                        {votingUpActive ? (
                            <a
                                href="#"
                                onClick={() => null}
                                className="confirm_weight"
                                title={tt('g.upvote')}
                            >
                                <Icon size="2x" name={'empty'} />
                            </a>
                        ) : (
                            <a
                                href="#"
                                onClick={this.voteUp}
                                className="confirm_weight"
                                title={tt('g.upvote')}
                            >
                                <Icon size="2x" name="chevron-up-circle" />
                            </a>
                        )}
                        {slider(true)}
                        <CloseButton
                            className="Voting__adjust_weight_close"
                            onClick={() => this.setState({ showWeight: false })}
                        />
                    </div>
                </Dropdown>
            );
        }
        return (
            <span className="Voting">
                <span className="Voting__inner">
                    <span className={classUp}>
                        {voteChevron}
                        {dropdown}
                    </span>
                    {downVote}
                    {payoutEl}
                </span>
                {voters_list}
            </span>
        );
    }
}

export default connect(
    // mapStateToProps
    (state, ownProps) => {
        const post = state.global.getIn(['content', ownProps.post]);
        if (!post) return ownProps;
        const scotData = post.get('scotData');
        const author = post.get('author');
        const permlink = post.get('permlink');
        const active_votes = post.get('active_votes');
        const is_comment = post.get('parent_author') !== '';

        const current_account = state.user.get('current');
        const username = current_account
            ? current_account.get('username')
            : null;
        const votingData = current_account
            ? current_account.get('voting')
            : null;
        const voting = state.global.get(
            `transaction_vote_active_${author}_${permlink}`
        );
        const tokenBalances = current_account
            ? current_account.get('token_balances')
            : null;
        const enable_slider = true;

        const price_per_steem = pricePerSteem(state);
        const sbd_print_rate = state.global.getIn(['props', 'sbd_print_rate']);

        return {
            post: ownProps.post,
            showList: ownProps.showList,
            author,
            permlink,
            username,
            active_votes,
            enable_slider,
            is_comment,
            post_obj: post,
            loggedin: username != null,
            voting,
            votingData,
            scotData,
            price_per_steem,
            sbd_print_rate,
        };
    },

    // mapDispatchToProps
    dispatch => ({
        vote: (weight, { author, permlink, username, myVote, isFlag }) => {
            const confirm = () => {
                if (myVote == null) return null;
                if (weight === 0)
                    return isFlag
                        ? tt('voting_jsx.removing_your_vote')
                        : tt(
                              'voting_jsx.removing_your_vote_will_reset_curation_rewards_for_this_post'
                          );
                if (weight > 0)
                    return isFlag
                        ? tt('voting_jsx.changing_to_an_upvote')
                        : tt(
                              'voting_jsx.changing_to_an_upvote_will_reset_curation_rewards_for_this_post'
                          );
                if (weight < 0)
                    return isFlag
                        ? tt('voting_jsx.changing_to_a_downvote')
                        : tt(
                              'voting_jsx.changing_to_a_downvote_will_reset_curation_rewards_for_this_post'
                          );
                return null;
            };
            dispatch(
                transactionActions.broadcastOperation({
                    type: 'vote',
                    operation: {
                        voter: username,
                        author,
                        permlink,
                        weight,
                        __config: {
                            title: weight < 0 ? 'Confirm Downvote' : null,
                        },
                    },
                    confirm,
                    errorCallback: errorKey => {
                        console.log('Transaction Error:' + errorKey);
                    },
                })
            );
        },
    })
)(Voting);
