import React, { useState, useEffect } from 'react';
import { WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
    Connection, PublicKey, Transaction, LAMPORTS_PER_SOL,
    TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import {
    ConnectButton,
    ModalProvider,
    useAccount,
    useConnectKit
} from '@particle-network/connect-react-ui';
import { SolanaDevnet } from '@particle-network/chains';
import { solanaWallets } from '@particle-network/connect';
import '@particle-network/connect-react-ui/dist/index.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import { Buffer } from 'buffer';
window.Buffer = Buffer;
const CONNECTION = new Connection("https://devnet.helius-rpc.com/?api-key=1fe7d1fb-c283-404e-8bf4-231484ec3251");
const PROGRAM_ID = new PublicKey('3QXWXyWGoodXqNqX86AjSacEfv9dgu4aauF3s3qCCwv2');
const MINT = new PublicKey('SMUSDBKt1cydTsvZmSHBS2CWAoi32FWPdFD7u9SwH3w');
const MINT_AUTH = new PublicKey('3iXwE1P6manizqC1pVaK4MVdNcqUtBKxJbCrDUMxHZmH');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

const ParticleProvider = ({ children }) => {
    return (
        <ModalProvider
            options={{
                projectId: "50abf86a-ade7-4587-8d2b-70a55e29de1c",
                clientKey: "cyTvaY8ATsL0FDqlnrD4D6kATr6GIFfGuGz1Lxlw",
                appId: "cb56f837-593a-41cf-8da5-ca9321c38f6e",
                chains: [SolanaDevnet],
                wallets: [...solanaWallets()],
                particleWalletEntry: { displayWalletEntry: true },
                solana: {
                    chain: SolanaDevnet
                }
            }}
        >
            {children}
        </ModalProvider>
    );
};

export default () => (
    <ParticleProvider>
        <WalletProvider wallets={[]} autoConnect>
            <WalletModalProvider>
                <Header />
                <Main />
            </WalletModalProvider>
        </WalletProvider>
    </ParticleProvider>
);

function Header() {
    return (
        <header>
            <img src="./icon.png" alt="token icon" />
            <h1>SMUSD Faucet</h1>
        </header>
    );
}

function Main() {
    const [balanceInfo, setBalanceInfo] = useState('');
    const [description, setDescription] = useState('');
    const { connected, wallet } = useWallet();
    const account = useAccount();
    const connectKit = useConnectKit();

    const getWalletPublicKey = async () => {
        if (account) {
            try {
                const address = await connectKit.particle.solana.getAddress();
                return new PublicKey(address);
            } catch (error) {
                console.error('Error getting Particle wallet address:', error);
                throw error;
            }
        }
        return wallet?.adapter?.publicKey;
    };

    const update_sol_balance = async () => {
        if (!account && !connected) return;
        
        try {
            const publicKey = await getWalletPublicKey();
            if (publicKey) {
                const balance = await CONNECTION.getBalance(publicKey);
                setBalanceInfo(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
            }
        } catch (error) {
            console.error('Error updating balance:', error);
        }
    };


    const airdrop = async () => {
        if (!account && !connected) {
            alert('Please connect your wallet first');
            return;
        }

        try {
            const publicKey = await getWalletPublicKey();
            if (publicKey) {
                const sg = await CONNECTION.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
                await CONNECTION.confirmTransaction(sg, 'finalized');
                update_sol_balance();
                console.log(sg);
                alert('Airdroped 1 Sol.');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred. Try again later.');
        }
    };

    const submitHandler = async e => {
        e.preventDefault();

        if (!account) {
            alert('Please connect your Particle wallet first');
            return;
        }

        try {
            const wallet_key = await getWalletPublicKey();
            if (!wallet_key) {
                throw new Error('Unable to get wallet public key');
            }

            // Get the ATA (Associated Token Account)
            const ata = get_smusdc_ata(wallet_key);
            console.log(`Token account: ${ata.toBase58()}`);

            // Create new transaction
            const tx = new Transaction();
            
            // Get fresh blockhash
            const { blockhash } = await CONNECTION.getLatestBlockhash('confirmed');
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet_key;

            // Add mint instruction
            const mintInstruction = mint_smusdc(wallet_key, ata);
            tx.add(mintInstruction);

            // Prepare transaction for Particle wallet
            const transactions = [tx]; // Particle expects an array
            
            try {
                // Sign all transactions using Particle
                const signedTransactions = await connectKit.particle.solana.signAllTransactions(
                    transactions.map(tx => {
                        // Serialize each transaction
                        return Buffer.from(
                            tx.serialize({
                                verifySignatures: false,
                                requireAllSignatures: false
                            })
                        ).toString('base64');
                    })
                );

                // Get the first (and only) signed transaction
                const signedTx = Transaction.from(
                    Buffer.from(signedTransactions[0], 'base64')
                );

                // Send the signed transaction
                const signature = await CONNECTION.sendRawTransaction(
                    signedTx.serialize(),
                    {
                        skipPreflight: false,
                        preflightCommitment: 'confirmed'
                    }
                );

                console.log('Transaction sent:', signature);

                // Wait for confirmation
                const confirmation = await CONNECTION.confirmTransaction(signature, 'confirmed');

                if (confirmation.value.err) {
                    throw new Error(`Transaction failed: ${confirmation.value.err}`);
                }

                console.log('Transaction confirmed:', signature);
                alert('Transaction finished. Check your wallet.');
                
                update_sol_balance();
            } catch (error) {
                if (error.message.includes('User rejected')) {
                    alert('Transaction was rejected by the user');
                } else if (error.message.includes('0x1')) {
                    alert('You may already have the maximum number of SMUSD tokens');
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('Transaction error:', error);
            alert(`Transaction failed: ${error.message}`);
        }
    };

    useEffect(() => {
        if (account || connected) {
            update_sol_balance();
        }
    }, [account, connected]);

    useEffect(() => {
        CONNECTION.getAccountInfo(MINT_AUTH)
            .then(res => {
                if (!res) return;        
                const max_wallet_balance = new DataView(res.data.buffer).getUint16(1, false);
                const str = `New users get 1000 SMUSD. Returning users can only top their wallet up to ${max_wallet_balance} SMUSD. Markets are set up to consider this so bet carefully.`;
                setDescription(str);
            });
    }, []);

    return (
        <main>
            <div id="info">
                <h3>Switch your wallet to devnet to avoid the warnings from Phantom.</h3>
                <p>Open Phantom, click your wallet on top left, click the cog bottom right, Developer Settings, Testnet Mode.</p>
            </div>

            <div className="flex space-x-4">
                <ConnectButton />
                <WalletMultiButton />
            </div>
            <br />

            <button onClick={airdrop}>Get 1 devnet SOL if you need some.</button><br />
            <span id="balance">{balanceInfo}</span>

            <form onSubmit={submitHandler}>
                <h2>Now get SMUSD</h2>
                <p>{description}</p>
                <input type="submit" value="Ok, gimme SMUSD" />
            </form>
        </main>
    );
}

function mint_smusdc(wallet_id, ata) {
    return new TransactionInstruction({
        data: new Uint8Array([0]),
        programId: PROGRAM_ID,
        keys: [
            { isSigner: true, isWritable: false, pubkey: wallet_id },
            { isSigner: false, isWritable: false, pubkey: MINT_AUTH },
            { isSigner: false, isWritable: true, pubkey: ata },
            { isSigner: false, isWritable: true, pubkey: MINT },
            { isSigner: false, isWritable: false, pubkey: SYSVAR_RENT_PUBKEY },
            { isSigner: false, isWritable: false, pubkey: TOKEN_2022_PROGRAM_ID },
            { isSigner: false, isWritable: false, pubkey: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID },
            { isSigner: false, isWritable: false, pubkey: SystemProgram.programId }
        ]
    });
}

function get_smusdc_ata(wallet_id) {
    return PublicKey.findProgramAddressSync(
        [
            wallet_id.toBytes(),
            TOKEN_2022_PROGRAM_ID.toBytes(),
            MINT.toBytes()
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )[0];
}